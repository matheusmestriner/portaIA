"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { UnitSelect } from "@/components/shared/unit-select";
import { useUnitLabels } from "@/hooks/use-units-query";
import { listPanicAlerts, triggerPanicAlert } from "@/lib/api/security";
import { ApiError } from "@/lib/api/types";

function TriggerPanicDialog({ condominiumId, onTriggered }: { condominiumId: string; onTriggered: () => void }) {
  const [open, setOpen] = useState(false);
  const [unitId, setUnitId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    try {
      await triggerPanicAlert(
        { condominiumId, unitId: unitId || undefined, triggeredBy: "Portaria" },
        crypto.randomUUID(),
      );
      toast.success("Alerta de pânico acionado.");
      setUnitId("");
      setOpen(false);
      onTriggered();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível acionar o alerta.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" variant="destructive" className="h-16 text-lg">
          <AlertTriangle className="mr-2 size-5" />
          Acionar botão de pânico
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar acionamento</DialogTitle>
          <DialogDescription>Isso registra um alerta de emergência para este condomínio.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <p className="text-sm font-medium">Unidade envolvida (opcional)</p>
          <UnitSelect
            condominiumId={condominiumId}
            value={unitId}
            onChange={setUnitId}
            placeholder="Nenhuma unidade específica"
          />
        </div>
        <DialogFooter>
          <Button variant="destructive" onClick={submit} disabled={submitting}>
            {submitting ? "Acionando..." : "Confirmar acionamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PanicoTab({ condominiumId }: { condominiumId: string }) {
  const queryClient = useQueryClient();
  const unitLabels = useUnitLabels(condominiumId);
  const alertsQuery = useQuery({
    queryKey: ["panic-alerts", condominiumId],
    queryFn: () => listPanicAlerts(condominiumId, 1, 50),
  });

  return (
    <div className="space-y-6">
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle>Emergência</CardTitle>
          <CardDescription>
            Aciona um alerta imediato. Use em situações de emergência real na portaria ou no condomínio.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TriggerPanicDialog
            condominiumId={condominiumId}
            onTriggered={() => queryClient.invalidateQueries({ queryKey: ["panic-alerts", condominiumId] })}
          />
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Histórico de acionamentos</h2>
        {alertsQuery.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unidade</TableHead>
                <TableHead>Acionado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alertsQuery.data?.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-muted-foreground">
                    Nenhum alerta acionado ainda.
                  </TableCell>
                </TableRow>
              )}
              {alertsQuery.data?.items.map((alert) => (
                <TableRow key={alert.id}>
                  <TableCell className="font-medium">
                    {alert.unitId ? (unitLabels[alert.unitId] ?? alert.unitId) : "Área comum"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(alert.createdAt).toLocaleString("pt-BR")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
