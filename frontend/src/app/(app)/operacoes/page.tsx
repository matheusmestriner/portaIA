"use client";

import { useQuery } from "@tanstack/react-query";
import { Bell, MessageCircle, Phone, Radio, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useSessionStore } from "@/lib/auth/session-store";
import { getWhatsAppStatus, listAnnouncements, listCalls, listExtensions, listOutboxEntries } from "@/lib/api/operations";

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleString("pt-BR") : "—";
}

function QueryState({ loading, failed, empty, children }: { loading: boolean; failed: boolean; empty: boolean; children: React.ReactNode }) {
  if (loading) return <Skeleton className="h-24 w-full" />;
  if (failed) return <p className="text-sm text-muted-foreground">Não foi possível carregar estes dados agora.</p>;
  if (empty) return <p className="text-sm text-muted-foreground">Nenhum registro encontrado.</p>;
  return <>{children}</>;
}

export default function OperationsPage() {
  const condominiumId = useSessionStore((state) => state.claims?.condominiumId);
  const enabled = Boolean(condominiumId);
  const whatsapp = useQuery({ queryKey: ["whatsapp-status"], queryFn: getWhatsAppStatus });
  const announcements = useQuery({ queryKey: ["announcements", condominiumId], queryFn: () => listAnnouncements(condominiumId!), enabled });
  const outbox = useQuery({ queryKey: ["outbox", condominiumId], queryFn: () => listOutboxEntries(condominiumId!), enabled });
  const extensions = useQuery({ queryKey: ["extensions", condominiumId], queryFn: () => listExtensions(condominiumId!), enabled });
  const calls = useQuery({ queryKey: ["calls", condominiumId], queryFn: () => listCalls(condominiumId!), enabled });

  if (!condominiumId) {
    return (
      <Card className="max-w-xl">
        <CardHeader><CardTitle>Central de Operações</CardTitle><CardDescription>Selecione ou acesse um condomínio para consultar comunicação e telefonia.</CardDescription></CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Central de Operações</h1>
        <p className="text-sm text-muted-foreground">Acompanhamento real das comunicações e da telefonia do condomínio.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatusCard icon={MessageCircle} label="WhatsApp" value={whatsapp.data?.connected ? "Conectado" : "Indisponível"} detail={whatsapp.data?.connected ? "Canal pronto para envio" : whatsapp.data?.reason ?? "Integração não configurada"} loading={whatsapp.isLoading} />
        <StatusCard icon={Phone} label="Ramais ativos" value={extensions.data?.items.filter((item) => item.isActive).length?.toString() ?? "0"} detail={`${extensions.data?.total ?? 0} ramais cadastrados`} loading={extensions.isLoading} />
        <StatusCard icon={Radio} label="Chamadas em fila" value={calls.data?.items.filter((item) => item.status === "QUEUED").length?.toString() ?? "0"} detail={`${calls.data?.total ?? 0} chamadas registradas`} loading={calls.isLoading} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Bell className="size-4" /> Comunicados</CardTitle><CardDescription>Últimos comunicados publicados para os moradores.</CardDescription></CardHeader>
          <CardContent>
            <QueryState loading={announcements.isLoading} failed={announcements.isError} empty={!announcements.data?.items.length}>
              <ul className="space-y-4">
                {announcements.data?.items.map((item) => <li key={item.id} className="border-b border-border pb-3 last:border-0 last:pb-0"><p className="font-medium">{item.title}</p><p className="mt-1 text-sm text-muted-foreground line-clamp-2">{item.body}</p><p className="mt-2 text-xs text-muted-foreground">{formatDate(item.createdAt)}</p></li>)}
              </ul>
            </QueryState>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="size-4" /> Entregas de notificação</CardTitle><CardDescription>Resultado das tentativas registradas no outbox.</CardDescription></CardHeader>
          <CardContent>
            <QueryState loading={outbox.isLoading} failed={outbox.isError} empty={!outbox.data?.items.length}>
              <ul className="space-y-3">
                {outbox.data?.items.map((item) => <li key={item.id} className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{item.recipient}</p><p className="text-xs text-muted-foreground">{formatDate(item.attemptedAt ?? item.createdAt)}</p></div><Badge variant={item.status === "SENT" ? "default" : "secondary"}>{item.status}</Badge></li>)}
              </ul>
            </QueryState>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Ramais</CardTitle><CardDescription>Ramais provisionados para unidades.</CardDescription></CardHeader>
          <CardContent>
            <QueryState loading={extensions.isLoading} failed={extensions.isError} empty={!extensions.data?.items.length}>
              <ul className="space-y-3">{extensions.data?.items.map((item) => <li key={item.id} className="flex items-center justify-between"><div><p className="font-medium">Ramal {item.number}</p><p className="text-xs text-muted-foreground">Usuário SIP: {item.sipUsername}</p></div><Badge variant={item.isActive ? "default" : "secondary"}>{item.isActive ? "Ativo" : "Inativo"}</Badge></li>)}</ul>
            </QueryState>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Chamadas recentes</CardTitle><CardDescription>Histórico de chamadas operacionais registrado pela API.</CardDescription></CardHeader>
          <CardContent>
            <QueryState loading={calls.isLoading} failed={calls.isError} empty={!calls.data?.items.length}>
              <ul className="space-y-3">{calls.data?.items.map((item) => <li key={item.id} className="flex items-center justify-between gap-3"><div><p className="font-medium">{item.callerType} → {item.calleeType}</p><p className="text-xs text-muted-foreground">{formatDate(item.createdAt)}</p></div><Badge variant={item.status === "ANSWERED" ? "default" : "secondary"}>{item.status}</Badge></li>)}</ul>
            </QueryState>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatusCard({ icon: Icon, label, value, detail, loading }: { icon: typeof Bell; label: string; value: string; detail: string; loading: boolean }) {
  return <Card><CardContent className="flex items-center gap-3 py-4"><span className="flex size-10 items-center justify-center rounded-[10px] bg-primary/10 text-primary"><Icon className="size-5" /></span><div>{loading ? <Skeleton className="h-5 w-20" /> : <p className="font-semibold">{value}</p>}<p className="text-xs text-muted-foreground">{label} · {detail}</p></div></CardContent></Card>;
}
