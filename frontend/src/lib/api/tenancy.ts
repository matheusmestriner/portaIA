import { apiFetch } from "./client";
import type { Paginated } from "./types";

export interface ResaleResponse {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
}

export interface ClientResponse {
  id: string;
  resaleId: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
}

export interface CondominiumResponse {
  id: string;
  clientId: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
}

export function listResales(page: number, pageSize: number): Promise<Paginated<ResaleResponse>> {
  return apiFetch(`/platform/resales?page=${page}&pageSize=${pageSize}`);
}

export function createResale(name: string, slug: string, idempotencyKey: string): Promise<ResaleResponse> {
  return apiFetch("/platform/resales", {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: { name, slug },
  });
}

export function listClients(
  resaleId: string,
  page: number,
  pageSize: number,
): Promise<Paginated<ClientResponse>> {
  return apiFetch(`/platform/clients?resaleId=${resaleId}&page=${page}&pageSize=${pageSize}`);
}

export function createClient(
  name: string,
  slug: string,
  idempotencyKey: string,
  resaleId?: string,
): Promise<ClientResponse> {
  return apiFetch("/platform/clients", {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: { name, slug, ...(resaleId ? { resaleId } : {}) },
  });
}

export function listCondominiums(
  clientId: string,
  page: number,
  pageSize: number,
): Promise<Paginated<CondominiumResponse>> {
  return apiFetch(`/platform/condominiums?clientId=${clientId}&page=${page}&pageSize=${pageSize}`);
}

export function createCondominium(
  name: string,
  slug: string,
  idempotencyKey: string,
  clientId?: string,
): Promise<CondominiumResponse> {
  return apiFetch("/platform/condominiums", {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: { name, slug, ...(clientId ? { clientId } : {}) },
  });
}
