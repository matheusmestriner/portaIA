"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Camera, MonitorPlay, RadioTower } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useSessionStore } from "@/lib/auth/session-store";
import { listCameras } from "@/lib/api/vms";

export default function ViewsPage() {
  const condominiumId = useSessionStore((state) => state.claims?.condominiumId);
  const cameras = useQuery({ queryKey: ["vms-cameras", condominiumId], queryFn: () => listCameras(condominiumId!), enabled: Boolean(condominiumId) });
  const [cameraId, setCameraId] = useState("");
  const selected = cameras.data?.items.find((camera) => camera.id === cameraId) ?? cameras.data?.items[0];
  return <div className="space-y-6"><div><h1 className="text-xl font-semibold">Visualizações</h1><p className="text-sm text-muted-foreground">Consulta individual e segura das câmeras cadastradas.</p></div>{cameras.isLoading ? <Skeleton className="h-96 w-full" /> : !cameras.data?.items.length ? <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Cadastre uma câmera para iniciar a visualização.</CardContent></Card> : <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]"><Card className="min-h-[420px]"><CardContent className="flex h-full min-h-[420px] flex-col items-center justify-center gap-3 text-center"><MonitorPlay className="size-12 text-muted-foreground" /><div><p className="font-medium">{selected?.name}</p><p className="mt-1 max-w-md text-sm text-muted-foreground">Nenhuma transmissão é exibida até uma central VMS integrada fornecer uma URL de stream temporária e autorizada.</p></div></CardContent></Card><Card><CardHeader><CardTitle>Detalhes</CardTitle></CardHeader><CardContent className="space-y-4"><Select value={selected?.id ?? ""} onValueChange={setCameraId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{cameras.data.items.map((camera) => <SelectItem key={camera.id} value={camera.id}>{camera.name}</SelectItem>)}</SelectContent></Select><Detail label="Status" value={selected?.status ?? "—"} badge /><Detail label="Localização" value={selected?.location ?? "Não informada"} /><Detail label="Telemetria" value={selected?.lastSeenAt ? new Date(selected.lastSeenAt).toLocaleString("pt-BR") : "Ainda não recebida"} /><div className="rounded-lg border border-border p-3 text-xs text-muted-foreground"><RadioTower className="mb-2 size-4 text-primary" />A visualização respeitará a licença VMS e a permissão do usuário quando o adaptador estiver configurado.</div></CardContent></Card></div>}</div>;
}

function Detail({ label, value, badge }: { label: string; value: string; badge?: boolean }) { return <div><p className="text-xs text-muted-foreground">{label}</p>{badge ? <Badge className="mt-1" variant={value === "ONLINE" ? "default" : "secondary"}>{value}</Badge> : <p className="mt-1 text-sm font-medium">{value}</p>}</div>; }
