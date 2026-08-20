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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { UnitSelect } from "@/components/shared/unit-select";
import { useUnitLabels } from "@/hooks/use-units-query";
import { listVisitors, createVisitor } from "@/lib/api/gatehouse";
import { ApiError } from "@/lib/api/types";

const schema = z
  .object({
    unitId: z.string().uuid("Selecione uma unidade"),
    name: z.string().min(1, "Informe o nome").max(150),
    document: z.string().max(30).optional(),
    validFrom: z.string().min(1, "Informe o início"),
    validUntil: z.string().min(1, "Informe o fim"),
  })
  .refine((data) => new Date(data.validUntil) > new Date(data.validFrom), {
    message: "O fim deve ser depois do início",
    path: ["validUntil"],
  });
type FormValues = z.infer<typeof schema>;

function defaultDateTimeLocal(offsetMs = 0): string {
  const d = new Date(Date.now() + offsetMs);
  d.setSeconds(0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function VisitantesTab({ condominiumId }: { condominiumId: string }) {
  const queryClient = useQueryClient();
  const unitLabels = useUnitLabels(condominiumId);
  const [open, setOpen] = useState(false);

  const visitorsQuery = useQuery({
    queryKey: ["visitors", condominiumId],
    queryFn: () => listVisitors(condominiumId, 1, 50),
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      unitId: "",
      name: "",
      document: "",
      validFrom: defaultDateTimeLocal(),
      validUntil: defaultDateTimeLocal(4 * 3600_000),
    },
  });

  async function onSubmit(values: FormValues) {
    try {
      await createVisitor(
        {
          unitId: values.unitId,
          name: values.name,
          document: values.document || undefined,
          validFrom: new Date(values.validFrom).toISOString(),
          validUntil: new Date(values.validUntil).toISOString(),
        },
        crypto.randomUUID(),
      );
      toast.success("Visitante registrado com sucesso.");
      form.reset({
        unitId: "",
        name: "",
        document: "",
        validFrom: defaultDateTimeLocal(),
        validUntil: defaultDateTimeLocal(4 * 3600_000),
      });
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["visitors", condominiumId] });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível registrar o visitante.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Visitantes registrados, com autorização já aprovada.</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">Registrar visitante</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar visitante</DialogTitle>
              <DialogDescription>A autorização é criada automaticamente, já aprovada.</DialogDescription>
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
                  name="document"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Documento (opcional)</FormLabel>
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
                    name="validFrom"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Válido de</FormLabel>
                        <FormControl>
                          <Input type="datetime-local" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="validUntil"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Válido até</FormLabel>
                        <FormControl>
                          <Input type="datetime-local" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? "Registrando..." : "Registrar"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {visitorsQuery.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead>Registrado em</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visitorsQuery.data?.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Nenhum visitante registrado ainda.
                </TableCell>
              </TableRow>
            )}
            {visitorsQuery.data?.items.map((visitor) => (
              <TableRow key={visitor.id}>
                <TableCell className="font-medium">{visitor.name}</TableCell>
                <TableCell>{unitLabels[visitor.unitId] ?? visitor.unitId}</TableCell>
                <TableCell className="text-muted-foreground">{visitor.document ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(visitor.createdAt).toLocaleString("pt-BR")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
