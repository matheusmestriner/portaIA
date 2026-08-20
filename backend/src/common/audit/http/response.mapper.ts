import type { AuditLog } from '@prisma/client';

export interface AuditLogResponse {
  id: string;
  actorUserId: string | null;
  actorRole: string | null;
  tenantResaleId: string | null;
  tenantClientId: string | null;
  tenantCondominiumId: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  result: string;
  createdAt: string;
}

export function toAuditLogResponse(a: AuditLog): AuditLogResponse {
  return {
    id: a.id,
    actorUserId: a.actorUserId,
    actorRole: a.actorRole,
    tenantResaleId: a.tenantResaleId,
    tenantClientId: a.tenantClientId,
    tenantCondominiumId: a.tenantCondominiumId,
    action: a.action,
    targetType: a.targetType,
    targetId: a.targetId,
    result: a.result,
    createdAt: a.createdAt.toISOString(),
  };
}
