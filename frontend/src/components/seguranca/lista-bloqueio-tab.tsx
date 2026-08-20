"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { listBlockListEntries, addBlockListEntry } from "@/lib/api/security";
import { ApiError } from "@/lib/api/types";

const createSchema = z.object({
  document: z.string().min(3, "Mínimo 3 caracteres").max(30),
  name: z.string().max(150).optional(),
  reason: z.string().min(1, "Informe o motivo").max(300),
});
type CreateValues = z.infer<typeof createSchema>;

function AddBlockListDialog({ condominiumId, onAdded }: { condominiumId: string; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const form = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { document: "", name: "", reason: "" },
  });

  async function onSubmit(values: CreateValues) {
    try {
      await addBlockListEntry(
        { condominiumId, document: values.document, name: values.name || undefined, reason: values.reason },
        crypto.randomUUID(),
      );
      toast.success("Entrada adicionada à lista de bloqueio.");
      form.reset({ document: "", name: "", reason: "" });
      setOpen(false);
      onAdded();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast.error("Este documento já está na lista de bloqueio.");
      } else {
        toast.error(err instanceof ApiError ? err.message : "Não foi possível adicionar.");
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Bloquear documento</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar à lista de bloqueio</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="document"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Documento (CPF/RG/placa)</FormLabel>
                  <FormControl>
                    <Input {...field} />
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
                  <FormLabel>Nome (opcional)</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Motivo</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Adicionando..." : "Adicionar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function ListaBloqueioTab({ condominiumId }: { condominiumId: string }) {
  const queryClient = useQueryClient();
  const entriesQuery = useQuery({
    queryKey: ["block-list", condominiumId],
    queryFn: () => listBlockListEntries(condominiumId, 1, 50),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <AddBlockListDialog
          condominiumId={condominiumId}
          onAdded={() => queryClient.invalidateQueries({ queryKey: ["block-list", condominiumId] })}
        />
      </div>

      {entriesQuery.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Documento</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead>Adicionado em</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entriesQuery.data?.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Nenhuma entrada na lista de bloqueio.
                </TableCell>
              </TableRow>
            )}
            {entriesQuery.data?.items.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="font-medium">{entry.document}</TableCell>
                <TableCell>{entry.name ?? "—"}</TableCell>
                <TableCell>{entry.reason}</TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(entry.createdAt).toLocaleString("pt-BR")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
