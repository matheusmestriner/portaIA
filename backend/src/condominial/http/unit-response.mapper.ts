import type { Unit } from '@prisma/client';

/** Never return raw Prisma rows — trims internal-only tenancy plumbing (resaleId/clientId) from the wire response. */
export interface UnitResponse {
  id: string;
  condominiumId: string;
  identifier: string;
  block: string | null;
  floor: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function toUnitResponse(unit: Unit): UnitResponse {
  return {
    id: unit.id,
    condominiumId: unit.condominiumId,
    identifier: unit.identifier,
    block: unit.block,
    floor: unit.floor,
    isActive: unit.isActive,
    createdAt: unit.createdAt.toISOString(),
    updatedAt: unit.updatedAt.toISOString(),
  };
}
