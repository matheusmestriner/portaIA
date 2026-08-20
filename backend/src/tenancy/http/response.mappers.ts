import type { Client, Condominium, Resale } from '@prisma/client';

export interface ResaleResponse {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
}

export function toResaleResponse(r: Resale): ResaleResponse {
  return { id: r.id, name: r.name, slug: r.slug, isActive: r.isActive, createdAt: r.createdAt.toISOString() };
}

export interface ClientResponse {
  id: string;
  resaleId: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
}

export function toClientResponse(c: Client): ClientResponse {
  return {
    id: c.id,
    resaleId: c.resaleId,
    name: c.name,
    slug: c.slug,
    isActive: c.isActive,
    createdAt: c.createdAt.toISOString(),
  };
}

export interface CondominiumResponse {
  id: string;
  clientId: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
}

export function toCondominiumResponse(c: Condominium): CondominiumResponse {
  return {
    id: c.id,
    clientId: c.clientId,
    name: c.name,
    slug: c.slug,
    isActive: c.isActive,
    createdAt: c.createdAt.toISOString(),
  };
}
