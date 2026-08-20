"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSessionStore } from "@/lib/auth/session-store";
import { VisitantesTab } from "@/components/portaria/visitantes-tab";
import { EntregasTab } from "@/components/portaria/entregas-tab";
import { ChavesTab } from "@/components/portaria/chaves-tab";

export default function PortariaPage() {
  const claims = useSessionStore((s) => s.claims);
  if (!claims?.condominiumId) return null;
  const condominiumId = claims.condominiumId;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Portaria</h1>
        <p className="text-sm text-muted-foreground">Visitantes, entregas e chaves do seu condomínio.</p>
      </div>
      <Tabs defaultValue="entregas">
        <TabsList>
          <TabsTrigger value="entregas">Entregas</TabsTrigger>
          <TabsTrigger value="visitantes">Visitantes</TabsTrigger>
          <TabsTrigger value="chaves">Chaves</TabsTrigger>
        </TabsList>
        <TabsContent value="entregas">
          <EntregasTab condominiumId={condominiumId} />
        </TabsContent>
        <TabsContent value="visitantes">
          <VisitantesTab condominiumId={condominiumId} />
        </TabsContent>
        <TabsContent value="chaves">
          <ChavesTab condominiumId={condominiumId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
