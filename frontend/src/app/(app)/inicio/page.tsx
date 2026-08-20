"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, KeyRound, Package, Siren, UserCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSessionStore } from "@/lib/auth/session-store";
import { PERMISSIONS, ROLE_LABELS, roleHasPermission, type UserRole } from "@/lib/auth/permissions";
import { getDeliveriesByStatus, getOverview, type CountByGroup } from "@/lib/api/reports";
import { listAuditLogs } from "@/lib/api/audit";

export default function InicioPage() {
  const claims = useSessionStore((s) => s.claims);
  if (!claims) return null;

  if (!claims.condominiumId || !roleHasPermission(claims.role, PERMISSIONS.REPORTS_VIEW)) {
    return (
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Bem-vindo ao Portalia</CardTitle>
          <CardDescription>Use o menu lateral para acessar os módulos disponíveis para o seu papel.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return <OperationalDashboard condominiumId={claims.condominiumId} />;
}

const DELIVERY_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendentes",
  COLLECTED: "Retiradas",
  RETURNED: "Devolvidas",
};

const DELIVERY_STATUS_COLORS: Record<string, string> = {
  PENDING: "var(--warning)",
  COLLECTED: "var(--success)",
  RETURNED: "var(--muted-foreground)",
};

function OperationalDashboard({ condominiumId }: { condominiumId: string }) {
  const overviewQuery = useQuery({
    queryKey: ["reports", "overview", condominiumId],
    queryFn: () => getOverview(condominiumId),
  });
  const deliveriesQuery = useQuery({
    queryKey: ["reports", "deliveries", condominiumId],
    queryFn: () => getDeliveriesByStatus(condominiumId),
  });
  const activityQuery = useQuery({
    queryKey: ["audit-logs", "recent"],
    queryFn: () => listAuditLogs(1, 6),
  });

  const overview = overviewQuery.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Visão operacional</h1>
        <p className="text-sm text-muted-foreground">Panorama do seu condomínio.</p>
      </div>

      {overview && overview.activePanicAlerts > 0 && (
        <Link
          href="/seguranca"
          className="flex items-center gap-3 rounded-[var(--radius)] border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive transition-colors hover:bg-destructive/15"
        >
          <Siren className="size-4 shrink-0" aria-hidden="true" />
          {overview.activePanicAlerts === 1
            ? "1 alerta de pânico ativo — toque para ver"
            : `${overview.activePanicAlerts} alertas de pânico ativos — toque para ver`}
        </Link>
      )}

      {overviewQuery.isError ? (
        <p className="text-sm text-muted-foreground">Não foi possível carregar os indicadores agora.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard icon={Package} label="Entregas pendentes" value={overview?.pendingDeliveries} loading={overviewQuery.isLoading} href="/portaria" />
          <MetricCard icon={UserCheck} label="Visitantes hoje" value={overview?.visitorsToday} loading={overviewQuery.isLoading} href="/portaria" />
          <MetricCard icon={KeyRound} label="Chaves em uso" value={overview?.keysCheckedOut} loading={overviewQuery.isLoading} href="/portaria" />
          <MetricCard icon={AlertTriangle} label="Ocorrências abertas" value={overview?.openOccurrences} loading={overviewQuery.isLoading} href="/seguranca" />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Entregas por status</CardTitle>
            <CardDescription>Total histórico do condomínio.</CardDescription>
          </CardHeader>
          <CardContent>
            {deliveriesQuery.isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : deliveriesQuery.isError ? (
              <p className="text-sm text-muted-foreground">Não foi possível carregar as entregas agora.</p>
            ) : (
              <DeliveryDonut data={deliveriesQuery.data} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Atividade recente</CardTitle>
            <CardDescription>Últimas ações registradas no seu escopo.</CardDescription>
          </CardHeader>
          <CardContent>
            {activityQuery.isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : activityQuery.isError ? (
              <p className="text-sm text-muted-foreground">Não foi possível carregar a atividade agora.</p>
            ) : !activityQuery.data?.items.length ? (
              <p className="text-sm text-muted-foreground">Nenhuma atividade registrada ainda.</p>
            ) : (
              <ul className="space-y-3">
                {activityQuery.data.items.map((entry) => (
                  <li key={entry.id} className="flex items-start gap-3 text-sm">
                    <span
                      className="mt-1.5 size-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: entry.result === "SUCCESS" ? "var(--success)" : "var(--destructive)" }}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{humanizeAction(entry.action)}</p>
                      <p className="text-xs text-muted-foreground">
                        {entry.actorRole ? `${ROLE_LABELS[entry.actorRole as UserRole] ?? entry.actorRole} · ` : ""}
                        {new Date(entry.createdAt).toLocaleString("pt-BR")}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  loading,
  href,
}: {
  icon: typeof Package;
  label: string;
  value: number | undefined;
  loading: boolean;
  href: string;
}) {
  return (
    <Link href={href}>
      <Card className="transition-colors hover:border-primary/40">
        <CardContent className="flex items-center gap-3 py-2">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-primary/10 text-primary">
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            {loading ? <Skeleton className="h-6 w-10" /> : <p className="text-xl leading-tight font-semibold">{value ?? 0}</p>}
            <p className="truncate text-xs text-muted-foreground">{label}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function DeliveryDonut({ data }: { data: CountByGroup | undefined }) {
  const byGroup = data?.byGroup ?? {};
  const total = data?.total ?? 0;
  const statuses = Object.keys(DELIVERY_STATUS_LABELS);

  if (total === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma entrega registrada ainda.</p>;
  }

  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  let drawn = 0;

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 140 140" className="size-32 shrink-0 -rotate-90">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="var(--muted)" strokeWidth="16" />
        {statuses.map((status) => {
          const count = byGroup[status] ?? 0;
          if (count === 0) return null;
          const dash = (count / total) * circumference;
          const offset = -drawn;
          drawn += dash;
          return (
            <circle
              key={status}
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke={DELIVERY_STATUS_COLORS[status]}
              strokeWidth="16"
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={offset}
            />
          );
        })}
      </svg>
      <ul className="space-y-2 text-sm">
        {statuses.map((status) => (
          <li key={status} className="flex items-center gap-2">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: DELIVERY_STATUS_COLORS[status] }} aria-hidden="true" />
            <span className="text-muted-foreground">{DELIVERY_STATUS_LABELS[status]}</span>
            <span className="ml-auto font-medium">{byGroup[status] ?? 0}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function humanizeAction(action: string): string {
  return action
    .split(/[._]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
