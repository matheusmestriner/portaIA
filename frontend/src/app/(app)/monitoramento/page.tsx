"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, CircleAlert, RadioTower, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useSessionStore } from "@/lib/auth/session-store";
import { createAlarmEvent, createAlarmPanel, createCamera, createVmsServer, listAlarmEvents, listAlarmPanels, listCameras, listSecurityLicenses, listVmsServers, type VmsProvider } from "@/lib/api/vms";

const providerLabels: Record<VmsProvider, string> = { GENERIC_ONVIF: "ONVIF", HIKVISION: "Hikvision", DAHUA: "Dahua", INTELBRAS: "Intelbras", MILESTONE: "Milestone", GENETEC: "Genetec", OTHER: "Outro" };
const featureLabels: Record<string, string> = { VMS: "VMS", LPR: "Leitura de placas", FACE_DETECTION: "Detecção facial", VIDEO_ANALYTICS: "Vídeo analítico" };

function date(value: string | null | undefined) { return value ? new Date(value).toLocaleString("pt-BR") : "Sem telemetria"; }

export default function MonitoringPage() {
  const condominiumId = useSessionStore((state) => state.claims?.condominiumId);
  const queryClient = useQueryClient();
  const [serverName, setServerName] = useState("");
  const [cameraName, setCameraName] = useState("");
  const [panelName, setPanelName] = useState("");
  const [eventMessage, setEventMessage] = useState("");
  const [provider, setProvider] = useState<VmsProvider>("GENERIC_ONVIF");
  const [serverId, setServerId] = useState<string | undefined>();
  const [eventType, setEventType] = useState("INTRUSION");
  const enabled = Boolean(condominiumId);
  const servers = useQuery({ queryKey: ["vms-servers", condominiumId], queryFn: () => listVmsServers(condominiumId!), enabled });
  const cameras = useQuery({ queryKey: ["vms-cameras", condominiumId], queryFn: () => listCameras(condominiumId!), enabled });
  const panels = useQuery({ queryKey: ["alarm-panels", condominiumId], queryFn: () => listAlarmPanels(condominiumId!), enabled });
  const events = useQuery({ queryKey: ["alarm-events", condominiumId], queryFn: () => listAlarmEvents(condominiumId!), enabled });
  const licenses = useQuery({ queryKey: ["security-licenses", condominiumId], queryFn: () => listSecurityLicenses(condominiumId!), enabled });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["vms"] }).then(() => Promise.all([queryClient.invalidateQueries({ queryKey: ["alarm-panels", condominiumId] }), queryClient.invalidateQueries({ queryKey: ["alarm-events", condominiumId] }), queryClient.invalidateQueries({ queryKey: ["security-licenses", condominiumId] })]));
  const submit = async (action: () => Promise<unknown>, done: () => void) => { try { await action(); done(); await refresh(); toast.success("Registro salvo com sucesso."); } catch { toast.error("Não foi possível concluir a operação."); } };

  if (!condominiumId) return <Card className="max-w-xl"><CardHeader><CardTitle>Monitoramento</CardTitle><CardDescription>Um condomínio é necessário para registrar e acompanhar o VMS.</CardDescription></CardHeader></Card>;

  return <div className="space-y-6"><div><h1 className="text-xl font-semibold">Monitoramento e VMS</h1><p className="text-sm text-muted-foreground">Cadastre ativos, acompanhe alarmes e mantenha o licenciamento preparado para recursos avançados.</p></div>
    <div className="grid gap-4 md:grid-cols-4"><Metric icon={RadioTower} label="Centrais VMS" value={servers.data?.total} /><Metric icon={Camera} label="Câmeras" value={cameras.data?.total} /><Metric icon={ShieldAlert} label="Centrais de alarme" value={panels.data?.total} /><Metric icon={CircleAlert} label="Alarmes abertos" value={events.data?.items.filter((item) => item.status === "OPEN").length} /></div>
    <div className="grid gap-4 xl:grid-cols-2"><Card><CardHeader><CardTitle>Central VMS</CardTitle><CardDescription>O cadastro não testa conexão nem armazena credenciais.</CardDescription></CardHeader><CardContent className="flex gap-2"><Input value={serverName} onChange={(e) => setServerName(e.target.value)} placeholder="Nome da central" /><Select value={provider} onValueChange={(value) => setProvider(value as VmsProvider)}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(providerLabels).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select><Button disabled={!serverName} onClick={() => submit(() => createVmsServer({ condominiumId, name: serverName, provider }), () => setServerName(""))}>Adicionar</Button></CardContent></Card>
      <Card><CardHeader><CardTitle>Central de alarme</CardTitle><CardDescription>Registre a central para associar eventos e futuras integrações.</CardDescription></CardHeader><CardContent className="flex gap-2"><Input value={panelName} onChange={(e) => setPanelName(e.target.value)} placeholder="Nome da central" /><Button disabled={!panelName} onClick={() => submit(() => createAlarmPanel({ condominiumId, name: panelName, provider, vmsServerId: serverId }), () => setPanelName(""))}>Adicionar</Button></CardContent></Card></div>
    <Card><CardHeader><CardTitle>Câmeras</CardTitle><CardDescription>Ativos cadastrados. O status muda apenas quando uma integração homologada reportar telemetria.</CardDescription></CardHeader><CardContent className="space-y-3"><div className="flex gap-2"><Input value={cameraName} onChange={(e) => setCameraName(e.target.value)} placeholder="Nome da câmera" /><Select value={serverId ?? "none"} onValueChange={(value) => setServerId(value === "none" ? undefined : value)}><SelectTrigger className="w-56"><SelectValue placeholder="Sem central" /></SelectTrigger><SelectContent><SelectItem value="none">Sem central</SelectItem>{servers.data?.items.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select><Button disabled={!cameraName} onClick={() => submit(() => createCamera({ condominiumId, name: cameraName, vmsServerId: serverId }), () => setCameraName(""))}>Adicionar câmera</Button></div><Rows loading={cameras.isLoading} empty={!cameras.data?.items.length}>{cameras.data?.items.map((item) => <div className="flex items-center justify-between border-t pt-3" key={item.id}><div><p className="font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{item.location ?? "Local não informado"} · {date(item.lastSeenAt)}</p></div><Badge variant="secondary">{item.status}</Badge></div>)}</Rows></CardContent></Card>
    <div className="grid gap-4 xl:grid-cols-2"><Card><CardHeader><CardTitle>Evento de alarme</CardTitle><CardDescription>Registro operacional manual para a central ainda não integrada.</CardDescription></CardHeader><CardContent className="space-y-2"><Select value={eventType} onValueChange={setEventType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["INTRUSION", "PANIC", "TAMPER", "FIRE", "POWER_FAILURE", "COMMUNICATION_FAILURE", "OTHER"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select><Input value={eventMessage} onChange={(e) => setEventMessage(e.target.value)} placeholder="Descrição do evento" /><Button disabled={!eventMessage} onClick={() => submit(() => createAlarmEvent({ condominiumId, type: eventType, message: eventMessage }), () => setEventMessage(""))}>Registrar evento</Button></CardContent></Card>
      <Card><CardHeader><CardTitle>Licenças de segurança</CardTitle><CardDescription>Catálogo pronto para licenciamento por condomínio.</CardDescription></CardHeader><CardContent><Rows loading={licenses.isLoading} empty={!licenses.data?.items.length}>{licenses.data?.items.map((item) => <div className="flex items-center justify-between border-t py-2" key={item.id}><span>{featureLabels[item.feature] ?? item.feature}</span><Badge>{item.quantity} licença(s)</Badge></div>)}</Rows>{!licenses.data?.items.length && !licenses.isLoading && <p className="text-sm text-muted-foreground">Nenhuma licença atribuída. A plataforma pode liberar VMS, LPR, detecção facial e analytics por condomínio.</p>}</CardContent></Card></div>
    <Card><CardHeader><CardTitle>Eventos recentes</CardTitle></CardHeader><CardContent><Rows loading={events.isLoading} empty={!events.data?.items.length}>{events.data?.items.map((item) => <div className="flex items-center justify-between border-t py-3" key={item.id}><div><p className="font-medium">{item.type}</p><p className="text-sm text-muted-foreground">{item.message}</p><p className="text-xs text-muted-foreground">{date(item.occurredAt)}</p></div><Badge variant={item.status === "OPEN" ? "destructive" : "secondary"}>{item.status}</Badge></div>)}</Rows></CardContent></Card>
  </div>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof Camera; label: string; value: number | undefined }) { return <Card><CardContent className="flex items-center gap-3 py-4"><Icon className="size-5 text-primary" /><div><p className="text-xl font-semibold">{value ?? 0}</p><p className="text-xs text-muted-foreground">{label}</p></div></CardContent></Card>; }
function Rows({ loading, empty, children }: { loading: boolean; empty: boolean; children: React.ReactNode }) { if (loading) return <Skeleton className="h-20 w-full" />; if (empty) return <p className="text-sm text-muted-foreground">Nenhum registro encontrado.</p>; return <div>{children}</div>; }
