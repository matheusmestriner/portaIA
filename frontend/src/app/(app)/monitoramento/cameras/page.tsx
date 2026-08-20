"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Plus, RadioTower } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useSessionStore } from "@/lib/auth/session-store";
import { createCamera, createVmsServer, listCameras, listVmsServers, type VmsProvider } from "@/lib/api/vms";

const providers: Record<VmsProvider, string> = { GENERIC_ONVIF: "ONVIF", HIKVISION: "Hikvision", DAHUA: "Dahua", INTELBRAS: "Intelbras", MILESTONE: "Milestone", GENETEC: "Genetec", OTHER: "Outro" };

export default function CamerasPage() {
  const condominiumId = useSessionStore((state) => state.claims?.condominiumId);
  const client = useQueryClient();
  const [cameraName, setCameraName] = useState("");
  const [location, setLocation] = useState("");
  const [serverId, setServerId] = useState("none");
  const [serverName, setServerName] = useState("");
  const [provider, setProvider] = useState<VmsProvider>("GENERIC_ONVIF");
  const enabled = Boolean(condominiumId);
  const cameras = useQuery({ queryKey: ["vms-cameras", condominiumId], queryFn: () => listCameras(condominiumId!), enabled });
  const servers = useQuery({ queryKey: ["vms-servers", condominiumId], queryFn: () => listVmsServers(condominiumId!), enabled });
  const refresh = () => Promise.all([client.invalidateQueries({ queryKey: ["vms-cameras", condominiumId] }), client.invalidateQueries({ queryKey: ["vms-servers", condominiumId] })]);
  const addCamera = async () => { if (!condominiumId || !cameraName) return; try { await createCamera({ condominiumId, name: cameraName, location: location || undefined, vmsServerId: serverId === "none" ? undefined : serverId }); setCameraName(""); setLocation(""); await refresh(); toast.success("Câmera cadastrada."); } catch { toast.error("Não foi possível cadastrar a câmera."); } };
  const addServer = async () => { if (!condominiumId || !serverName) return; try { await createVmsServer({ condominiumId, name: serverName, provider }); setServerName(""); await refresh(); toast.success("Central VMS cadastrada."); } catch { toast.error("Não foi possível cadastrar a central."); } };

  if (!condominiumId) return <EmptyScope />;
  return <div className="space-y-6"><div><h1 className="text-xl font-semibold">Câmeras</h1><p className="text-sm text-muted-foreground">Cadastre e acompanhe os ativos de vídeo do condomínio.</p></div>
    <div className="grid gap-4 xl:grid-cols-2"><Card><CardHeader><CardTitle className="flex items-center gap-2"><RadioTower className="size-4" /> Central VMS</CardTitle><CardDescription>O status será atualizado quando um adaptador homologado estiver configurado.</CardDescription></CardHeader><CardContent className="flex flex-col gap-2 sm:flex-row"><Input value={serverName} onChange={(event) => setServerName(event.target.value)} placeholder="Nome da central" /><Select value={provider} onValueChange={(value) => setProvider(value as VmsProvider)}><SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(providers).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select><Button disabled={!serverName} onClick={addServer}><Plus />Adicionar</Button></CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Camera className="size-4" /> Nova câmera</CardTitle><CardDescription>Credenciais e stream não são armazenados nesta tela.</CardDescription></CardHeader><CardContent className="grid gap-2 sm:grid-cols-2"><Input value={cameraName} onChange={(event) => setCameraName(event.target.value)} placeholder="Nome da câmera" /><Input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Localização" /><Select value={serverId} onValueChange={setServerId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Sem central vinculada</SelectItem>{servers.data?.items.map((server) => <SelectItem key={server.id} value={server.id}>{server.name}</SelectItem>)}</SelectContent></Select><Button disabled={!cameraName} onClick={addCamera}><Plus />Adicionar câmera</Button></CardContent></Card></div>
    {cameras.isLoading ? <Skeleton className="h-48 w-full" /> : cameras.data?.items.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{cameras.data.items.map((camera) => <Card key={camera.id}><CardContent className="space-y-3 py-5"><div className="flex items-start justify-between"><span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Camera className="size-5" /></span><Badge variant={camera.status === "ONLINE" ? "default" : "secondary"}>{camera.status}</Badge></div><div><p className="font-medium">{camera.name}</p><p className="text-sm text-muted-foreground">{camera.location ?? "Localização não informada"}</p></div><p className="text-xs text-muted-foreground">{camera.lastSeenAt ? `Última telemetria: ${new Date(camera.lastSeenAt).toLocaleString("pt-BR")}` : "Aguardando telemetria da central"}</p></CardContent></Card>)}</div> : <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Nenhuma câmera cadastrada.</CardContent></Card>}</div>;
}

function EmptyScope() { return <Card className="max-w-xl"><CardHeader><CardTitle>Câmeras</CardTitle><CardDescription>Selecione um condomínio para visualizar as câmeras.</CardDescription></CardHeader></Card>; }
