import type { Consent, DataSubjectRequest, LegalHold } from '@prisma/client';

export interface ConsentResponse {
  id: string;
  condominiumId: string;
  subjectName: string;
  subjectDocument: string | null;
  purpose: string;
  granted: boolean;
  grantedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export function toConsentResponse(c: Consent): ConsentResponse {
  return {
    id: c.id,
    condominiumId: c.condominiumId,
    subjectName: c.subjectName,
    subjectDocument: c.subjectDocument,
    purpose: c.purpose,
    granted: c.granted,
    grantedAt: c.grantedAt?.toISOString() ?? null,
    revokedAt: c.revokedAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
  };
}

export interface DataSubjectRequestResponse {
  id: string;
  condominiumId: string;
  requesterName: string;
  requesterDocument: string;
  type: string;
  status: string;
  details: string | null;
  resolvedBy: string | null;
  resolutionNotes: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export function toDataSubjectRequestResponse(r: DataSubjectRequest): DataSubjectRequestResponse {
  return {
    id: r.id,
    condominiumId: r.condominiumId,
    requesterName: r.requesterName,
    requesterDocument: r.requesterDocument,
    type: r.type,
    status: r.status,
    details: r.details,
    resolvedBy: r.resolvedBy,
    resolutionNotes: r.resolutionNotes,
    createdAt: r.createdAt.toISOString(),
    resolvedAt: r.resolvedAt?.toISOString() ?? null,
  };
}

export interface LegalHoldResponse {
  id: string;
  condominiumId: string;
  subjectDocument: string;
  reason: string;
  createdBy: string;
  createdAt: string;
  liftedAt: string | null;
  liftedBy: string | null;
}

export function toLegalHoldResponse(h: LegalHold): LegalHoldResponse {
  return {
    id: h.id,
    condominiumId: h.condominiumId,
    subjectDocument: h.subjectDocument,
    reason: h.reason,
    createdBy: h.createdBy,
    createdAt: h.createdAt.toISOString(),
    liftedAt: h.liftedAt?.toISOString() ?? null,
    liftedBy: h.liftedBy,
  };
}
