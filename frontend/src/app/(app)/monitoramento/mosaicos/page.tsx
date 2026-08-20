"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Camera, Grid2X2, Grid3X3, Grid3X3Icon, RadioTower } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSessionStore } from "@/lib/auth/session-store";
import { listCameras } from "@/lib/api/vms";

const layouts = [{ slots: 4, label: "2 × 2", icon: Grid2X2 }, { slots: 9, label: "3 × 3", icon: Grid3X3 }, { slots: 16, label: "4 × 4", icon: Grid3X3Icon }];

export default function MosaicsPage() {
  const condominiumId = useSessionStore((state) => state.claims?.condominiumId);
  const [slots, setSlots] = useState(4);
  const cameras = useQuery({ queryKey: ["vms-cameras", condominiumId], queryFn: () => listCameras(condominiumId!), enabled: Boolean(condominiumId) });
  const grid = slots === 4 ? "grid-cols-2" : slots === 9 ? "grid-cols-3" : "grid-cols-4";
  const cells = Array.from({ length: slots }, (_, index) => cameras.data?.items[index]);
  return <div className="space-y-6"><div><h1 className="text-xl font-semibold">Mosaicos</h1><p className="text-sm text-muted-foreground">Organize as câmeras em uma grade de monitoramento.</p></div><div className="flex flex-wrap gap-2">{layouts.map((layout) => <Button key={layout.slots} variant={slots === layout.slots ? "default" : "outline"} onClick={() => setSlots(layout.slots)}><layout.icon />{layout.label}</Button>)}</div>{cameras.isLoading ? <Skeleton className="h-96 w-full" /> : <div className={`grid ${grid} gap-3`}>{cells.map((camera, index) => <Card key={camera?.id ?? `empty-${index}`} className="aspect-video overflow-hidden"><CardContent className="flex h-full flex-col items-center justify-center gap-2 p-3 text-center"><Camera className="size-6 text-muted-foreground" />{camera ? <><p className="text-sm font-medium">{camera.name}</p><p className="text-xs text-muted-foreground">{camera.status === "ONLINE" ? "Stream depende do conector VMS" : "Sem stream disponível"}</p></> : <p className="text-xs text-muted-foreground">Espaço disponível</p>}</CardContent></Card>)}</div>}<Card><CardHeader><CardTitle className="flex items-center gap-2"><RadioTower className="size-4" /> Estado do mosaico</CardTitle><CardDescription>O layout é interativo nesta sessão. A transmissão só aparecerá depois que a central VMS fornecer um stream autorizado.</CardDescription></CardHeader></Card></div>;
}
