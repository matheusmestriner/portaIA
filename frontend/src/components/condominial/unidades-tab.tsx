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
import { listUnits, createUnit } from "@/lib/api/condominial";
import { ApiError } from "@/lib/api/types";

const schema = z.object({
  identifier: z.string().min(1, "Informe o número/identificador").max(50),
  block: z.string().max(50).optional(),
  floor: z.string().max(20).optional(),
});
type Values = z.infer<typeof schema>;

export function UnidadesTab({ condominiumId, canManage }: { condominiumId: string; canManage: boolean }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const unitsQuery = useQuery({
    queryKey: ["units", condominiumId, "list"],
    queryFn: () => listUnits(condominiumId, 1, 100),
  });

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { identifier: "", block: "", floor: "" },
  });

  async function onSubmit(values: Values) {
    try {
      await createUnit(
        {
          condominiumId,
          identifier: values.identifier,
          block: values.block || undefined,
          floor: values.floor || undefined,
        },
        crypto.randomUUID(),
      );
      toast.success("Unidade criada.");
      form.reset({ identifier: "", block: "", floor: "" });
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["units", condominiumId] });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast.error("Já existe uma unidade com esse identificador neste condomínio.");
      } else {
        toast.error(err instanceof ApiError ? err.message : "Não foi possível criar a unidade.");
      }
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Apartamentos e casas do condomínio.</p>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">Nova unidade</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova unidade</DialogTitle>
                <DialogDescription>O identificador é único dentro do condomínio.</DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="identifier"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Número / identificador</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex.: 101" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="block"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bloco / torre</FormLabel>
                          <FormControl>
                            <Input placeholder="Ex.: A" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="floor"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Andar</FormLabel>
                          <FormControl>
                            <Input placeholder="Ex.: 1" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={form.formState.isSubmitting}>
                      {form.formState.isSubmitting ? "Criando..." : "Criar unidade"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {unitsQuery.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Unidade</TableHead>
              <TableHead>Bloco</TableHead>
              <TableHead>Andar</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {unitsQuery.data?.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Nenhuma unidade cadastrada ainda.
                </TableCell>
              </TableRow>
            )}
            {unitsQuery.data?.items.map((unit) => (
              <TableRow key={unit.id}>
                <TableCell className="font-medium">{unit.identifier}</TableCell>
                <TableCell>{unit.block ?? "—"}</TableCell>
                <TableCell>{unit.floor ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={unit.isActive ? "default" : "secondary"}>
                    {unit.isActive ? "Ativa" : "Inativa"}
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
