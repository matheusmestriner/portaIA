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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listOccurrences, createOccurrence, type OccurrenceSeverity } from "@/lib/api/security";
import { ApiError } from "@/lib/api/types";

const createSchema = z.object({
  title: z.string().min(1, "Informe o título").max(150),
  description: z.string().min(1, "Descreva a ocorrência").max(2000),
  severity: z.enum(["LOW", "MEDIUM", "HIGH"]),
  reportedBy: z.string().min(1, "Informe quem reportou").max(150),
});
type CreateValues = z.infer<typeof createSchema>;

const SEVERITY_LABELS: Record<OccurrenceSeverity, string> = { LOW: "Baixa", MEDIUM: "Média", HIGH: "Alta" };
const SEVERITY_VARIANTS: Record<OccurrenceSeverity, "secondary" | "default" | "destructive"> = {
  LOW: "secondary",
  MEDIUM: "default",
  HIGH: "destructive",
};

function CreateOccurrenceDialog({ condominiumId, onCreated }: { condominiumId: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const form = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { title: "", description: "", severity: "LOW", reportedBy: "" },
  });

  async function onSubmit(values: CreateValues) {
    try {
      await createOccurrence({ condominiumId, ...values }, crypto.randomUUID());
      toast.success("Ocorrência registrada.");
      form.reset({ title: "", description: "", severity: "LOW", reportedBy: "" });
      setOpen(false);
      onCreated();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível registrar a ocorrência.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Registrar ocorrência</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar ocorrência</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título</FormLabel>
                  <FormControl>
                    <Input {...field} />
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
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="severity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Severidade</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="LOW">Baixa</SelectItem>
                      <SelectItem value="MEDIUM">Média</SelectItem>
                      <SelectItem value="HIGH">Alta</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="reportedBy"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reportado por</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Registrando..." : "Registrar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function OcorrenciasTab({ condominiumId }: { condominiumId: string }) {
  const queryClient = useQueryClient();
  const occurrencesQuery = useQuery({
    queryKey: ["occurrences", condominiumId],
    queryFn: () => listOccurrences(condominiumId, 1, 50),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <CreateOccurrenceDialog
          condominiumId={condominiumId}
          onCreated={() => queryClient.invalidateQueries({ queryKey: ["occurrences", condominiumId] })}
        />
      </div>

      {occurrencesQuery.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead>Severidade</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Reportado por</TableHead>
              <TableHead>Criado em</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {occurrencesQuery.data?.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Nenhuma ocorrência registrada ainda.
                </TableCell>
              </TableRow>
            )}
            {occurrencesQuery.data?.items.map((occurrence) => (
              <TableRow key={occurrence.id}>
                <TableCell className="font-medium">{occurrence.title}</TableCell>
                <TableCell>
                  <Badge variant={SEVERITY_VARIANTS[occurrence.severity]}>
                    {SEVERITY_LABELS[occurrence.severity]}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{occurrence.status}</TableCell>
                <TableCell className="text-muted-foreground">{occurrence.reportedBy}</TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(occurrence.createdAt).toLocaleString("pt-BR")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
