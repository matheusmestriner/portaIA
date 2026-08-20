"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { PackageCheck, RefreshCw, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UnitSelect } from "@/components/shared/unit-select";
import { ResidentSelect, NO_RESIDENT } from "@/components/shared/resident-select";
import { PhotoCapture, type PhotoSelection } from "@/components/shared/photo-capture";
import { QrScanner } from "@/components/shared/qr-scanner";
import { useUnitLabels } from "@/hooks/use-units-query";
import { uploadPhoto } from "@/lib/api/photos";
import {
  listDeliveries,
  createDelivery,
  redeemDelivery,
  reissuePickupCredential,
  type DeliveryStatus,
  type DeliveryCredentialResponse,
} from "@/lib/api/gatehouse";
import { ApiError } from "@/lib/api/types";

const createSchema = z.object({
  unitId: z.string().uuid("Selecione uma unidade"),
  residentId: z.string(),
  description: z.string().min(1, "Descreva a entrega").max(300),
  carrier: z.string().max(100).optional(),
  courierName: z.string().max(140).optional(),
  trackingCode: z.string().max(100).optional(),
  // O input HTML entrega string; a conversão para número acontece no submit.
  volumeCount: z
    .string()
    .min(1, "Informe os volumes")
    .refine((value) => Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 100, {
      message: "Informe de 1 a 100 volumes",
    }),
});
type CreateValues = z.infer<typeof createSchema>;

const STATUS_LABELS: Record<DeliveryStatus, string> = {
  PENDING: "Aguardando retirada",
  COLLECTED: "Retirada",
  RETURNED: "Devolvida",
};

function CredentialDialog({
  credential,
  onClose,
}: {
  credential: DeliveryCredentialResponse | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={credential !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Credencial de retirada</DialogTitle>
          <DialogDescription>
            O código foi enviado ao WhatsApp do morador. Ele aparece aqui uma única vez — anote se precisar
            repassar pessoalmente.
          </DialogDescription>
        </DialogHeader>
        {credential && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted p-6 text-center">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Código de retirada</p>
              <p className="font-mono text-4xl tracking-[0.3em]">{credential.pickupCode}</p>
            </div>
            <div className="flex flex-col items-center gap-2 rounded-lg border p-4">
              <p className="text-xs text-muted-foreground">QR Code para o app do morador</p>
              <div className="rounded bg-white p-3">
                <QRCodeSVG value={credential.qrPayload} size={168} />
              </div>
            </div>
            {credential.expiresAt && (
              <p className="text-center text-xs text-muted-foreground">
                Válida até {new Date(credential.expiresAt).toLocaleString("pt-BR")}
              </p>
            )}
          </div>
        )}
        <DialogFooter>
          <Button onClick={onClose}>Entendi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateDeliveryDialog({
  condominiumId,
  onCreated,
}: {
  condominiumId: string;
  onCreated: (credential: DeliveryCredentialResponse) => void;
}) {
  const [open, setOpen] = useState(false);
  const [photo, setPhoto] = useState<PhotoSelection | null>(null);
  const form = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { unitId: "", residentId: NO_RESIDENT, description: "", carrier: "", courierName: "", trackingCode: "", volumeCount: "1" },
  });
  const selectedUnitId = useWatch({ control: form.control, name: "unitId" });

  async function onSubmit(values: CreateValues) {
    try {
      // A foto sobe antes: o registro guarda só a referência à evidência.
      let receiptPhotoId: string | undefined;
      if (photo) {
        const uploaded = await uploadPhoto({
          condominiumId,
          category: "DELIVERY_RECEIPT",
          source: photo.source,
          file: photo.file,
        });
        receiptPhotoId = uploaded.id;
      }

      const credential = await createDelivery(
        {
          unitId: values.unitId,
          residentId: values.residentId === NO_RESIDENT ? undefined : values.residentId,
          description: values.description,
          carrier: values.carrier || undefined,
          courierName: values.courierName || undefined,
          trackingCode: values.trackingCode || undefined,
          volumeCount: Number(values.volumeCount),
          receiptPhotoId,
        },
        crypto.randomUUID(),
      );

      form.reset({ unitId: "", residentId: NO_RESIDENT, description: "", carrier: "", courierName: "", trackingCode: "", volumeCount: "1" });
      setPhoto(null);
      setOpen(false);
      onCreated(credential);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível registrar a entrega.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Registrar entrega</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Registrar entrega</DialogTitle>
          <DialogDescription>
            Fotografe a encomenda no ato do recebimento. O código de retirada é gerado e enviado ao morador.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="unitId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unidade</FormLabel>
                    <FormControl>
                      <UnitSelect condominiumId={condominiumId} value={field.value} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="residentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Destinatário</FormLabel>
                    <FormControl>
                      <ResidentSelect
                        condominiumId={condominiumId}
                        unitId={selectedUnitId}
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex.: Caixa dos Correios" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="carrier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Transportadora (opcional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Correios, Mercado Livre…" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="courierName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Entregador (opcional)</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="trackingCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rastreio</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="volumeCount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Volumes</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} max={100} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
            <div className="space-y-3">
              <PhotoCapture
                value={photo}
                onChange={setPhoto}
                label="Foto do recebimento"
                hint="Registre a encomenda no momento em que ela chega."
              />
            </div>
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Registrando..." : "Registrar entrega"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function RedeemDialog({ condominiumId, onDone }: { condominiumId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [credential, setCredential] = useState("");
  const [pickedUpBy, setPickedUpBy] = useState("");
  const [document, setDocument] = useState("");
  const [photo, setPhoto] = useState<PhotoSelection | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setCredential("");
    setPickedUpBy("");
    setDocument("");
    setPhoto(null);
    setScanning(false);
    setError(null);
  }

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      let pickupPhotoId: string | undefined;
      if (photo) {
        const uploaded = await uploadPhoto({
          condominiumId,
          category: "DELIVERY_PICKUP",
          source: photo.source,
          file: photo.file,
        });
        pickupPhotoId = uploaded.id;
      }

      await redeemDelivery({ credential, pickedUpBy, pickupDocument: document || undefined, pickupPhotoId }, crypto.randomUUID());
      toast.success("Retirada confirmada.");
      reset();
      setOpen(false);
      onDone();
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setError("Código ou QR Code inválido.");
      } else {
        setError(err instanceof ApiError ? err.message : "Não foi possível confirmar a retirada.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="default">
          <PackageCheck className="size-4" />
          Confirmar retirada
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Confirmar retirada</DialogTitle>
          <DialogDescription>
            O morador apresenta o código recebido no WhatsApp ou o QR Code do aplicativo.
          </DialogDescription>
        </DialogHeader>

        {scanning ? (
          <QrScanner
            onDetected={(value) => {
              setCredential(value);
              setScanning(false);
              toast.success("QR Code lido.");
            }}
            onCancel={() => setScanning(false)}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <p className="text-sm font-medium">Código ou QR</p>
                <div className="flex gap-2">
                  <Input
                    placeholder="000000"
                    value={credential}
                    onChange={(event) => setCredential(event.target.value)}
                    autoFocus
                  />
                  <Button type="button" variant="outline" onClick={() => setScanning(true)}>
                    <ScanLine className="size-4" />
                    Escanear
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="text-sm font-medium">Quem está retirando</p>
                <Input value={pickedUpBy} onChange={(event) => setPickedUpBy(event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <p className="text-sm font-medium">Documento (opcional)</p>
                <Input value={document} onChange={(event) => setDocument(event.target.value)} />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <PhotoCapture
              value={photo}
              onChange={setPhoto}
              label="Foto da retirada"
              hint="Fotografe quem está levando a encomenda."
            />
          </div>
        )}

        {!scanning && (
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={submitting || !credential || !pickedUpBy}>
              {submitting ? "Confirmando..." : "Confirmar retirada"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function EntregasTab({ condominiumId }: { condominiumId: string }) {
  const queryClient = useQueryClient();
  const unitLabels = useUnitLabels(condominiumId);
  const [statusFilter, setStatusFilter] = useState<DeliveryStatus | "ALL">("PENDING");
  const [credential, setCredential] = useState<DeliveryCredentialResponse | null>(null);

  const deliveriesQuery = useQuery({
    queryKey: ["deliveries", condominiumId, statusFilter],
    queryFn: () => listDeliveries(condominiumId, 1, 50, statusFilter === "ALL" ? undefined : statusFilter),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["deliveries", condominiumId] });
  }

  async function handleReissue(deliveryId: string) {
    try {
      const reissued = await reissuePickupCredential(deliveryId, crypto.randomUUID());
      setCredential(reissued);
      invalidate();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível reemitir a credencial.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as DeliveryStatus | "ALL")}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas</SelectItem>
            <SelectItem value="PENDING">Aguardando retirada</SelectItem>
            <SelectItem value="COLLECTED">Retiradas</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <RedeemDialog condominiumId={condominiumId} onDone={invalidate} />
          <CreateDeliveryDialog
            condominiumId={condominiumId}
            onCreated={(created) => {
              setCredential(created);
              invalidate();
            }}
          />
        </div>
      </div>

      {deliveriesQuery.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Unidade</TableHead>
              <TableHead>Entrega</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Código</TableHead>
              <TableHead>Recebida em</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {deliveriesQuery.data?.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Nenhuma entrega encontrada.
                </TableCell>
              </TableRow>
            )}
            {deliveriesQuery.data?.items.map((delivery) => (
              <TableRow key={delivery.id}>
                <TableCell className="font-medium">{unitLabels[delivery.unitId] ?? delivery.unitId}</TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span>{delivery.description}</span>
                    <span className="text-xs text-muted-foreground">
                      {[delivery.carrier, delivery.courierName].filter(Boolean).join(" · ") || "—"}
                      {delivery.volumeCount > 1 ? ` · ${delivery.volumeCount} volumes` : ""}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={delivery.status === "PENDING" ? "secondary" : "default"}>
                    {STATUS_LABELS[delivery.status]}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {delivery.pickupCodeLast4 ? `••${delivery.pickupCodeLast4}` : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(delivery.receivedAt).toLocaleString("pt-BR")}
                </TableCell>
                <TableCell className="text-right">
                  {delivery.status === "PENDING" && (
                    <Button size="sm" variant="ghost" onClick={() => handleReissue(delivery.id)}>
                      <RefreshCw className="size-4" />
                      Reenviar código
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <CredentialDialog credential={credential} onClose={() => setCredential(null)} />
    </div>
  );
}
