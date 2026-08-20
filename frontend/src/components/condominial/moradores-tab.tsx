"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { MessageCircle } from "lucide-react";
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
import { UnitSelect } from "@/components/shared/unit-select";
import { useUnitLabels } from "@/hooks/use-units-query";
import { listResidents, createResident } from "@/lib/api/condominial";
import { ApiError } from "@/lib/api/types";

const schema = z.object({
  unitId: z.string().uuid("Selecione a unidade"),
  name: z.string().min(1, "Informe o nome").max(150),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  phone: z.string().max(30).optional(),
});
type Values = z.infer<typeof schema>;

function CredentialDialog({
  credential,
  onClose,
}: {
  credential: { name: string; temporaryPassword: string } | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={credential !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Senha do app do morador</DialogTitle>
          <DialogDescription>
            {credential && `Repasse a ${credential.name} por um canal seguro. Essa senha não aparece de novo.`}
          </DialogDescription>
        </DialogHeader>
        {credential && (
          <div className="rounded-lg border bg-muted p-6 text-center">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Senha temporária</p>
            <p className="font-mono text-2xl tracking-wide break-all">{credential.temporaryPassword}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              O morador troca essa senha no primeiro login do app.
            </p>
          </div>
        )}
        <DialogFooter>
          <Button onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function MoradoresTab({ condominiumId, canManage }: { condominiumId: string; canManage: boolean }) {
  const queryClient = useQueryClient();
  const unitLabels = useUnitLabels(condominiumId);
  const [open, setOpen] = useState(false);
  const [credential, setCredential] = useState<{ name: string; temporaryPassword: string } | null>(null);

  const residentsQuery = useQuery({
    queryKey: ["residents", condominiumId],
    queryFn: () => listResidents({ condominiumId }, 1, 100),
  });

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { unitId: "", name: "", email: "", phone: "" },
  });

  async function onSubmit(values: Values) {
    try {
      const created = await createResident(
        {
          unitId: values.unitId,
          name: values.name,
          email: values.email || undefined,
          phone: values.phone || undefined,
        },
        crypto.randomUUID(),
      );
      toast.success("Morador cadastrado.");
      form.reset({ unitId: "", name: "", email: "", phone: "" });
      setOpen(false);
      if (created.temporaryPassword) {
        setCredential({ name: created.name, temporaryPassword: created.temporaryPassword });
      }
      await queryClient.invalidateQueries({ queryKey: ["residents", condominiumId] });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível cadastrar o morador.");
    }
  }

  const withoutPhone = residentsQuery.data?.items.filter((r) => !r.phone).length ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          O telefone é o que permite avisar o morador no WhatsApp quando uma entrega chega.
        </p>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">Novo morador</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo morador</DialogTitle>
                <DialogDescription>
                  Sem telefone cadastrado, o código de retirada não chega pelo WhatsApp — a portaria precisa
                  ditá-lo pessoalmente.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefone (WhatsApp)</FormLabel>
                        <FormControl>
                          <Input placeholder="(11) 99999-9999" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email (opcional)</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button type="submit" disabled={form.formState.isSubmitting}>
                      {form.formState.isSubmitting ? "Cadastrando..." : "Cadastrar morador"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {withoutPhone > 0 && (
        <p className="flex items-center gap-1.5 rounded-md border border-[var(--warning)]/40 bg-[var(--warning)]/10 p-2 text-xs">
          <MessageCircle className="size-4" />
          {withoutPhone} morador(es) sem telefone: não recebem o código de retirada pelo WhatsApp.
        </p>
      )}

      {residentsQuery.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {residentsQuery.data?.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Nenhum morador cadastrado ainda.
                </TableCell>
              </TableRow>
            )}
            {residentsQuery.data?.items.map((resident) => (
              <TableRow key={resident.id}>
                <TableCell className="font-medium">{resident.name}</TableCell>
                <TableCell>{unitLabels[resident.unitId] ?? resident.unitId}</TableCell>
                <TableCell className={resident.phone ? "" : "text-muted-foreground"}>
                  {resident.phone ?? "sem telefone"}
                </TableCell>
                <TableCell className="text-muted-foreground">{resident.email ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={resident.isActive ? "default" : "secondary"}>
                    {resident.isActive ? "Ativo" : "Inativo"}
                  </Badge>
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
