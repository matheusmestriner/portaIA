import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveTenantScope } from '../../auth/rbac/tenant-scope.resolver';
import { paginate, type PaginationQuery, type Paginated } from '../http/pagination';
import type { Actor } from '../../auth/actor';
import type { AuditLog } from '@prisma/client';

export interface AuditLogFilter {
  action?: string;
  targetType?: string;
}

@Injectable()
export class AuditQueryService {
  constructor(private readonly prisma: PrismaService) {}

  /** Scoped by the caller's own tenant via RLS — a resale admin only ever sees their resale's trail, never the whole platform's. */
  async list(actor: Actor, filter: AuditLogFilter, query: PaginationQuery): Promise<Paginated<AuditLog>> {
    const scope = resolveTenantScope(actor);
    const where = {
      ...(filter.action ? { action: filter.action } : {}),
      ...(filter.targetType ? { targetType: filter.targetType } : {}),
    };
    const [items, total] = await this.prisma.withTenantContext(scope, (tx) =>
      Promise.all([
        tx.auditLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        tx.auditLog.count({ where }),
      ]),
    );
    return paginate(items, total, query);
  }
}
