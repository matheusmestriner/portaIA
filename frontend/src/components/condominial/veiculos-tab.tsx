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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { UnitSelect } from "@/components/shared/unit-select";
import { useUnitLabels } from "@/hooks/use-units-query";
import { listVehicles, createVehicle } from "@/lib/api/condominial";
import { ApiError } from "@/lib/api/types";

const schema = z.object({
  unitId: z.string().uuid("Selecione a unidade"),
  plate: z.string().min(6, "Placa inválida").max(8),
  model: z.string().max(60).optional(),
  color: z.string().max(30).optional(),
});
type Values = z.infer<typeof schema>;

export function VeiculosTab({ condominiumId, canManage }: { condominiumId: string; canManage: boolean }) {
  const queryClient = useQueryClient();
  const unitLabels = useUnitLabels(condominiumId);
  const [open, setOpen] = useState(false);

  const vehiclesQuery = useQuery({
    queryKey: ["vehicles", condominiumId],
    queryFn: () => listVehicles(condominiumId, 1, 100),
  });

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { unitId: "", plate: "", model: "", color: "" },
  });

  async function onSubmit(values: Values) {
    try {
      await createVehicle(
        {
          unitId: values.unitId,
          plate: values.plate,
          model: values.model || undefined,
          color: values.color || undefined,
        },
        crypto.randomUUID(),
      );
      toast.success("Veículo cadastrado.");
      form.reset({ unitId: "", plate: "", model: "", color: "" });
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["vehicles", condominiumId] });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast.error("Esta placa já está cadastrada neste condomínio.");
      } else {
        toast.error(err instanceof ApiError ? err.message : "Não foi possível cadastrar o veículo.");
      }
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Veículos vinculados às unidades.</p>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">Novo veículo</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo veículo</DialogTitle>
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
                    name="plate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Placa</FormLabel>
                        <FormControl>
                          <Input placeholder="ABC1D23" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="model"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Modelo</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="color"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cor</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={form.formState.isSubmitting}>
                      {form.formState.isSubmitting ? "Cadastrando..." : "Cadastrar veículo"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {vehiclesQuery.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Placa</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead>Modelo</TableHead>
              <TableHead>Cor</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vehiclesQuery.data?.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Nenhum veículo cadastrado ainda.
                </TableCell>
              </TableRow>
            )}
            {vehiclesQuery.data?.items.map((vehicle) => (
              <TableRow key={vehicle.id}>
                <TableCell className="font-mono font-medium">{vehicle.plate}</TableCell>
                <TableCell>{unitLabels[vehicle.unitId] ?? vehicle.unitId}</TableCell>
                <TableCell>{vehicle.model ?? "—"}</TableCell>
                <TableCell>{vehicle.color ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={vehicle.isActive ? "default" : "secondary"}>
                    {vehicle.isActive ? "Ativo" : "Inativo"}
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
