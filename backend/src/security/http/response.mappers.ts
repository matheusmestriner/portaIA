import type { BlockListEntry, Occurrence, PanicAlert } from '@prisma/client';

export interface OccurrenceResponse {
  id: string;
  condominiumId: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  reportedBy: string;
  createdAt: string;
}

export function toOccurrenceResponse(o: Occurrence): OccurrenceResponse {
  return {
    id: o.id,
    condominiumId: o.condominiumId,
    title: o.title,
    description: o.description,
    severity: o.severity,
    status: o.status,
    reportedBy: o.reportedBy,
    createdAt: o.createdAt.toISOString(),
  };
}

export interface PanicAlertResponse {
  id: string;
  condominiumId: string;
  unitId: string | null;
  triggeredBy: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export function toPanicAlertResponse(p: PanicAlert): PanicAlertResponse {
  return {
    id: p.id,
    condominiumId: p.condominiumId,
    unitId: p.unitId,
    triggeredBy: p.triggeredBy,
    acknowledgedAt: p.acknowledgedAt?.toISOString() ?? null,
    resolvedAt: p.resolvedAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
  };
}

export interface BlockListEntryResponse {
  id: string;
  condominiumId: string;
  document: string;
  name: string | null;
  reason: string;
  createdAt: string;
}

export function toBlockListEntryResponse(b: BlockListEntry): BlockListEntryResponse {
  return {
    id: b.id,
    condominiumId: b.condominiumId,
    document: b.document,
    name: b.name,
    reason: b.reason,
    createdAt: b.createdAt.toISOString(),
  };
}
