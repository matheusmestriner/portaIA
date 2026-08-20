import type { Resident, Unit, Condominium } from '@prisma/client';

export interface ResidentMeResponse {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  unit: { id: string; identifier: string; block: string | null };
  condominium: { id: string; name: string };
}

export function toResidentMeResponse(resident: Resident & { unit: Unit & { condominium: Condominium } }): ResidentMeResponse {
  return {
    id: resident.id,
    name: resident.name,
    email: resident.email,
    phone: resident.phone,
    unit: { id: resident.unit.id, identifier: resident.unit.identifier, block: resident.unit.block },
    condominium: { id: resident.unit.condominium.id, name: resident.unit.condominium.name },
  };
}

export interface ResidentDashboardResponse {
  pendingDeliveries: number;
  visitorsThisMonth: number;
  avgVisitsPerWeek: number | null;
  /** Sempre null na V01: o schema não registra chegada/saída real do visitante, só o cadastro da visita e a janela autorizada — não existe base para uma média de tempo honesta ainda. */
  avgVisitDurationMinutes: null;
}

export interface ResidentTelephonyCredentialsResponse {
  configured: boolean;
  sipUsername: string | null;
  sipPassword: string | null;
  domain: string | null;
}
