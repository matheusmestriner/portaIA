"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
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
import { useUnitLabels } from "@/hooks/use-units-query";
import { listKeyRecords, createKeyRecord, checkOutKey, returnKey, type KeyRecordStatus } from "@/lib/api/gatehouse";
import { ApiError } from "@/lib/api/types";

const createSchema = z.object({
  unitId: z.string().uuid("Selecione uma unidade"),
  label: z.string().min(1, "Descreva a chave/objeto").max(100),
});
type CreateValues = z.infer<typeof createSchema>;

const STATUS_LABELS: Record<KeyRecordStatus, string> = {
  WITH_GATEHOUSE: "Com a portaria",
  CHECKED_OUT: "Retirada",
};

function CreateKeyDialog({ condominiumId, onCreated }: { condominiumId: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const form = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { unitId: "", label: "" },
  });

  async function onSubmit(values: CreateValues) {
    try {
      await createKeyRecord(values, crypto.randomUUID());
      toast.success("Chave cadastrada com sucesso.");
      form.reset({ unitId: "", label: "" });
      setOpen(false);
      onCreated();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível cadastrar a chave.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Cadastrar chave</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cadastrar chave/objeto</DialogTitle>
          <DialogDescription>Fica sob controle da portaria até a primeira retirada.</DialogDescription>
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
              name="label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rótulo</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex.: Chave reserva, Controle do portão" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Cadastrando..." : "Cadastrar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function CheckOutKeyDialog({ keyRecordId, onDone }: { keyRecordId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [checkedOutTo, setCheckedOutTo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    try {
      await checkOutKey(keyRecordId, checkedOutTo, crypto.randomUUID());
      toast.success("Retirada registrada.");
      setCheckedOutTo("");
      setOpen(false);
      onDone();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível registrar a retirada.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Retirar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar retirada</DialogTitle>
          <DialogDescription>Quem está levando?</DialogDescription>
        </DialogHeader>
        <Input
          placeholder="Nome de quem está retirando"
          value={checkedOutTo}
          onChange={(e) => setCheckedOutTo(e.target.value)}
          autoFocus
        />
        <DialogFooter>
          <Button onClick={submit} disabled={submitting || checkedOutTo.length === 0}>
            {submitting ? "Registrando..." : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ChavesTab({ condominiumId }: { condominiumId: string }) {
  const queryClient = useQueryClient();
  const unitLabels = useUnitLabels(condominiumId);
  const [statusFilter, setStatusFilter] = useState<KeyRecordStatus | "ALL">("ALL");

  const keysQuery = useQuery({
    queryKey: ["keys", condominiumId, statusFilter],
    queryFn: () => listKeyRecords(condominiumId, 1, 50, statusFilter === "ALL" ? undefined : statusFilter),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["keys", condominiumId] });
  }

  async function handleReturn(keyRecordId: string) {
    try {
      await returnKey(keyRecordId, crypto.randomUUID());
      toast.success("Devolução registrada.");
      invalidate();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível registrar a devolução.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as KeyRecordStatus | "ALL")}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas</SelectItem>
            <SelectItem value="WITH_GATEHOUSE">Com a portaria</SelectItem>
            <SelectItem value="CHECKED_OUT">Retiradas</SelectItem>
          </SelectContent>
        </Select>
        <CreateKeyDialog condominiumId={condominiumId} onCreated={invalidate} />
      </div>

      {keysQuery.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rótulo</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Com quem</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {keysQuery.data?.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Nenhuma chave cadastrada ainda.
                </TableCell>
              </TableRow>
            )}
            {keysQuery.data?.items.map((key) => (
              <TableRow key={key.id}>
                <TableCell className="font-medium">{key.label}</TableCell>
                <TableCell>{unitLabels[key.unitId] ?? key.unitId}</TableCell>
                <TableCell>
                  <Badge variant={key.status === "CHECKED_OUT" ? "secondary" : "default"}>
                    {STATUS_LABELS[key.status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{key.checkedOutTo ?? "—"}</TableCell>
                <TableCell className="text-right">
                  {key.status === "WITH_GATEHOUSE" && (
                    <CheckOutKeyDialog keyRecordId={key.id} onDone={invalidate} />
                  )}
                  {key.status === "CHECKED_OUT" && (
                    <Button size="sm" variant="outline" onClick={() => handleReturn(key.id)}>
                      Devolver
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
