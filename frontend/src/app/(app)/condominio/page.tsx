"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSessionStore } from "@/lib/auth/session-store";
import { PERMISSIONS, roleHasPermission } from "@/lib/auth/permissions";
import { UnidadesTab } from "@/components/condominial/unidades-tab";
import { MoradoresTab } from "@/components/condominial/moradores-tab";
import { VeiculosTab } from "@/components/condominial/veiculos-tab";
import { PrestadoresTab } from "@/components/condominial/prestadores-tab";

export default function CondominioPage() {
  const claims = useSessionStore((s) => s.claims);
  if (!claims?.condominiumId) return null;
  const condominiumId = claims.condominiumId;
  // Papéis operacionais (porteiro) enxergam os cadastros mas não os alteram.
  const canManage = roleHasPermission(claims.role, PERMISSIONS.CONDOMINIUM_MANAGE);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Condomínio</h1>
        <p className="text-sm text-muted-foreground">Unidades, moradores, veículos e prestadores.</p>
      </div>
      <Tabs defaultValue="moradores">
        <TabsList>
          <TabsTrigger value="moradores">Moradores</TabsTrigger>
          <TabsTrigger value="unidades">Unidades</TabsTrigger>
          <TabsTrigger value="veiculos">Veículos</TabsTrigger>
          <TabsTrigger value="prestadores">Prestadores</TabsTrigger>
        </TabsList>
        <TabsContent value="moradores">
          <MoradoresTab condominiumId={condominiumId} canManage={canManage} />
        </TabsContent>
        <TabsContent value="unidades">
          <UnidadesTab condominiumId={condominiumId} canManage={canManage} />
        </TabsContent>
        <TabsContent value="veiculos">
          <VeiculosTab condominiumId={condominiumId} canManage={canManage} />
        </TabsContent>
        <TabsContent value="prestadores">
          <PrestadoresTab condominiumId={condominiumId} canManage={canManage} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
