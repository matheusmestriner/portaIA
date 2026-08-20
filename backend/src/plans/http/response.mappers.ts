import type { Plan, Resale } from '@prisma/client';

export interface PlanResponse {
  id: string;
  key: string;
  name: string;
  description: string | null;
  modules: string[];
  isActive: boolean;
  createdAt: string;
}

export function toPlanResponse(p: Plan): PlanResponse {
  return {
    id: p.id,
    key: p.key,
    name: p.name,
    description: p.description,
    modules: p.modules,
    isActive: p.isActive,
    createdAt: p.createdAt.toISOString(),
  };
}

export interface ResaleWithPlanResponse {
  id: string;
  name: string;
  slug: string;
  planId: string | null;
  isActive: boolean;
}

export function toResaleWithPlanResponse(r: Resale): ResaleWithPlanResponse {
  return { id: r.id, name: r.name, slug: r.slug, planId: r.planId, isActive: r.isActive };
}
