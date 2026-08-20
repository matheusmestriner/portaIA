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
import { listProviders, createProvider } from "@/lib/api/condominial";
import { ApiError } from "@/lib/api/types";

const schema = z.object({
  name: z.string().min(1, "Informe o nome").max(150),
  document: z.string().min(11, "Informe um CPF ou CNPJ válido").max(18),
  company: z.string().max(150).optional(),
});
type Values = z.infer<typeof schema>;

/** O backend guarda só dígitos; formata para leitura na tabela. */
function formatDocument(digits: string): string {
  if (digits.length === 11) return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (digits.length === 14) return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return digits;
}

export function PrestadoresTab({ condominiumId, canManage }: { condominiumId: string; canManage: boolean }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const providersQuery = useQuery({
    queryKey: ["providers", condominiumId],
    queryFn: () => listProviders(condominiumId, 1, 100),
  });

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", document: "", company: "" },
  });

  async function onSubmit(values: Values) {
    try {
      await createProvider(
        { condominiumId, name: values.name, document: values.document, company: values.company || undefined },
        crypto.randomUUID(),
      );
      toast.success("Prestador cadastrado.");
      form.reset({ name: "", document: "", company: "" });
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["providers", condominiumId] });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast.error("Este documento já está cadastrado neste condomínio.");
      } else {
        toast.error(err instanceof ApiError ? err.message : "Não foi possível cadastrar o prestador.");
      }
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Prestadores recorrentes do condomínio.</p>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">Novo prestador</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo prestador</DialogTitle>
                <DialogDescription>CPF ou CNPJ, único por condomínio.</DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                    name="document"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CPF / CNPJ</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="company"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Empresa (opcional)</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button type="submit" disabled={form.formState.isSubmitting}>
                      {form.formState.isSubmitting ? "Cadastrando..." : "Cadastrar prestador"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {providersQuery.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {providersQuery.data?.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Nenhum prestador cadastrado ainda.
                </TableCell>
              </TableRow>
            )}
            {providersQuery.data?.items.map((provider) => (
              <TableRow key={provider.id}>
                <TableCell className="font-medium">{provider.name}</TableCell>
                <TableCell className="font-mono text-xs">{formatDocument(provider.document)}</TableCell>
                <TableCell>{provider.company ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={provider.isActive ? "default" : "secondary"}>
                    {provider.isActive ? "Ativo" : "Inativo"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
