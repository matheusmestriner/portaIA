"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSessionStore } from "@/lib/auth/session-store";
import { OcorrenciasTab } from "@/components/seguranca/ocorrencias-tab";
import { PanicoTab } from "@/components/seguranca/panico-tab";
import { ListaBloqueioTab } from "@/components/seguranca/lista-bloqueio-tab";

export default function SegurancaPage() {
  const claims = useSessionStore((s) => s.claims);
  if (!claims?.condominiumId) return null;
  const condominiumId = claims.condominiumId;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Segurança</h1>
        <p className="text-sm text-muted-foreground">Ocorrências, botão de pânico e lista de bloqueio.</p>
      </div>
      <Tabs defaultValue="ocorrencias">
        <TabsList>
          <TabsTrigger value="ocorrencias">Ocorrências</TabsTrigger>
          <TabsTrigger value="panico">Botão de Pânico</TabsTrigger>
          <TabsTrigger value="bloqueio">Lista de Bloqueio</TabsTrigger>
        </TabsList>
        <TabsContent value="ocorrencias">
          <OcorrenciasTab condominiumId={condominiumId} />
        </TabsContent>
        <TabsContent value="panico">
          <PanicoTab condominiumId={condominiumId} />
        </TabsContent>
        <TabsContent value="bloqueio">
          <ListaBloqueioTab condominiumId={condominiumId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
