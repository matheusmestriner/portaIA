import { apiFetch } from "./client";
import type { Paginated } from "./types";

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

export function listAuditLogs(page: number, pageSize: number): Promise<Paginated<AuditLogResponse>> {
  return apiFetch(`/platform/audit-logs?page=${page}&pageSize=${pageSize}`);
}
