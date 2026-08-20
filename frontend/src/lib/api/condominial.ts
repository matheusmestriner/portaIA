import { apiFetch } from "./client";
import type { Paginated } from "./types";

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

export function listUnits(
  condominiumId: string,
  page: number,
  pageSize: number,
): Promise<Paginated<UnitResponse>> {
  return apiFetch(`/condominial/units?condominiumId=${condominiumId}&page=${page}&pageSize=${pageSize}`);
}

export interface CreateUnitInput {
  condominiumId: string;
  identifier: string;
  block?: string;
  floor?: string;
}

export function createUnit(input: CreateUnitInput, idempotencyKey: string): Promise<UnitResponse> {
  return apiFetch("/condominial/units", {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: input,
  });
}

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

export function listResidents(
  filter: { condominiumId?: string; unitId?: string },
  page: number,
  pageSize: number,
): Promise<Paginated<ResidentResponse>> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (filter.condominiumId) params.set("condominiumId", filter.condominiumId);
  if (filter.unitId) params.set("unitId", filter.unitId);
  return apiFetch(`/condominial/residents?${params.toString()}`);
}

export interface CreateResidentInput {
  unitId: string;
  name: string;
  email?: string;
  phone?: string;
  isPrimary?: boolean;
}

export interface CreateResidentResponse extends ResidentResponse {
  /** Senha temporária de login do app do morador, em claro, devolvida uma única vez (null se o morador não tem email). */
  temporaryPassword: string | null;
}

export function createResident(input: CreateResidentInput, idempotencyKey: string): Promise<CreateResidentResponse> {
  return apiFetch("/condominial/residents", {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: input,
  });
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

export function listVehicles(
  condominiumId: string,
  page: number,
  pageSize: number,
): Promise<Paginated<VehicleResponse>> {
  return apiFetch(`/condominial/vehicles?condominiumId=${condominiumId}&page=${page}&pageSize=${pageSize}`);
}

export interface CreateVehicleInput {
  unitId: string;
  plate: string;
  model?: string;
  color?: string;
}

export function createVehicle(input: CreateVehicleInput, idempotencyKey: string): Promise<VehicleResponse> {
  return apiFetch("/condominial/vehicles", {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: input,
  });
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

export function listProviders(
  condominiumId: string,
  page: number,
  pageSize: number,
): Promise<Paginated<ProviderResponse>> {
  return apiFetch(`/condominial/providers?condominiumId=${condominiumId}&page=${page}&pageSize=${pageSize}`);
}

export interface CreateProviderInput {
  condominiumId: string;
  name: string;
  document: string;
  company?: string;
}

export function createProvider(input: CreateProviderInput, idempotencyKey: string): Promise<ProviderResponse> {
  return apiFetch("/condominial/providers", {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: input,
  });
}
