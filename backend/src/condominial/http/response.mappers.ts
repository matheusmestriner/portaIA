import type { Provider, Resident, Vehicle } from '@prisma/client';

export interface ResidentResponse {
  id: string;
  unitId: string;
  condominiumId: string;
  name: string;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
  isActive: boolean;
  createdAt: string;
}

export function toResidentResponse(r: Resident): ResidentResponse {
  return {
    id: r.id,
    unitId: r.unitId,
    condominiumId: r.condominiumId,
    name: r.name,
    email: r.email,
    phone: r.phone,
    isPrimary: r.isPrimary,
    isActive: r.isActive,
    createdAt: r.createdAt.toISOString(),
  };
}

export interface VehicleResponse {
  id: string;
  unitId: string;
  condominiumId: string;
  plate: string;
  model: string | null;
  color: string | null;
  isActive: boolean;
  createdAt: string;
}

export function toVehicleResponse(v: Vehicle): VehicleResponse {
  return {
    id: v.id,
    unitId: v.unitId,
    condominiumId: v.condominiumId,
    plate: v.plate,
    model: v.model,
    color: v.color,
    isActive: v.isActive,
    createdAt: v.createdAt.toISOString(),
  };
}

export interface ProviderResponse {
  id: string;
  condominiumId: string;
  name: string;
  document: string;
  company: string | null;
  isActive: boolean;
  createdAt: string;
}

export function toProviderResponse(p: Provider): ProviderResponse {
  return {
    id: p.id,
    condominiumId: p.condominiumId,
    name: p.name,
    document: p.document,
    company: p.company,
    isActive: p.isActive,
    createdAt: p.createdAt.toISOString(),
  };
}
