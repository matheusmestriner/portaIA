import { Injectable } from '@nestjs/common';
import { AuditResult, type Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { TenantScope } from '../../prisma/prisma.service';

export interface AuditEntry {
  actorUserId: string | null;
  actorRole: string | null;
  scope: TenantScope;
  action: string;
  targetType: string;
  targetId?: string | null;
  result: AuditResult;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Never include secrets in `metadata` — this table is read by
   * compliance/audit tooling, not just engineers.
   */
  async record(entry: AuditEntry): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorUserId: entry.actorUserId,
        actorRole: entry.actorRole,
        tenantResaleId: entry.scope.resaleId ?? null,
        tenantClientId: entry.scope.clientId ?? null,
        tenantCondominiumId: entry.scope.condominiumId ?? null,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId ?? null,
        result: entry.result,
        metadata: entry.metadata,
      },
    });
  }
}
