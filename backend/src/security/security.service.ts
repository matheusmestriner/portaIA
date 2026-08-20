import { ForbiddenException, Injectable } from '@nestjs/common';
import { OccurrenceStatus, type BlockListEntry, type Occurrence, type PanicAlert } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { auditedOperation } from '../common/audit/audited-operation';
import { PERMISSIONS, roleHasPermission } from '../auth/rbac/permissions';
import { resolveTenantScope } from '../auth/rbac/tenant-scope.resolver';
import { paginate, type PaginationQuery, type Paginated } from '../common/http/pagination';
import type { Actor } from '../auth/actor';
import {
  addBlockListEntrySchema,
  createOccurrenceSchema,
  triggerPanicAlertSchema,
  type AddBlockListEntryInput,
  type CreateOccurrenceInput,
  type TriggerPanicAlertInput,
} from './dto';

@Injectable()
export class SecurityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async reportOccurrence(actor: Actor, input: CreateOccurrenceInput): Promise<Occurrence> {
    this.assertCanOperate(actor);
    const data = createOccurrenceSchema.parse(input);
    const scope = resolveTenantScope(actor);

    return auditedOperation(this.audit, actor, scope, 'occurrence.report', 'Occurrence', () =>
      this.prisma.withTenantContext(scope, async (tx) => {
        const condominium = await tx.condominium.findUniqueOrThrow({ where: { id: data.condominiumId } });
        return tx.occurrence.create({
          data: {
            condominiumId: condominium.id,
            title: data.title,
            description: data.description,
            severity: data.severity,
            reportedBy: data.reportedBy,
            resaleId: condominium.resaleId,
            clientId: condominium.clientId,
          },
        });
      }),
    );
  }

  async listOccurrences(
    actor: Actor,
    condominiumId: string,
    query: PaginationQuery,
    status?: OccurrenceStatus,
  ): Promise<Paginated<Occurrence>> {
    this.assertCanOperate(actor);
    const scope = resolveTenantScope(actor);
    const where = { condominiumId, ...(status ? { status } : {}) };
    const [items, total] = await this.prisma.withTenantContext(scope, (tx) =>
      Promise.all([
        tx.occurrence.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        tx.occurrence.count({ where }),
      ]),
    );
    return paginate(items, total, query);
  }

  /** Botão de pânico: sempre registrado, mesmo que o ator tenha permissão mínima (qualquer operador de portaria pode acionar). */
  async triggerPanicAlert(actor: Actor, input: TriggerPanicAlertInput): Promise<PanicAlert> {
    this.assertCanOperatePanic(actor);
    const data = triggerPanicAlertSchema.parse(input);
    const scope = resolveTenantScope(actor);

    return auditedOperation(this.audit, actor, scope, 'panic_alert.trigger', 'PanicAlert', () =>
      this.prisma.withTenantContext(scope, async (tx) => {
        const condominium = await tx.condominium.findUniqueOrThrow({ where: { id: data.condominiumId } });
        return tx.panicAlert.create({
          data: {
            condominiumId: condominium.id,
            unitId: data.unitId,
            triggeredBy: data.triggeredBy,
            resaleId: condominium.resaleId,
            clientId: condominium.clientId,
          },
        });
      }),
    );
  }

  async listPanicAlerts(actor: Actor, condominiumId: string, query: PaginationQuery): Promise<Paginated<PanicAlert>> {
    this.assertCanOperatePanic(actor);
    const scope = resolveTenantScope(actor);
    const [items, total] = await this.prisma.withTenantContext(scope, (tx) =>
      Promise.all([
        tx.panicAlert.findMany({
          where: { condominiumId },
          orderBy: { createdAt: 'desc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        tx.panicAlert.count({ where: { condominiumId } }),
      ]),
    );
    return paginate(items, total, query);
  }

  async addBlockListEntry(actor: Actor, input: AddBlockListEntryInput): Promise<BlockListEntry> {
    this.assertCanOperate(actor);
    const data = addBlockListEntrySchema.parse(input);
    const scope = resolveTenantScope(actor);

    return auditedOperation(this.audit, actor, scope, 'block_list_entry.add', 'BlockListEntry', () =>
      this.prisma.withTenantContext(scope, async (tx) => {
        const condominium = await tx.condominium.findUniqueOrThrow({ where: { id: data.condominiumId } });
        return tx.blockListEntry.create({
          data: {
            condominiumId: condominium.id,
            document: data.document,
            name: data.name,
            reason: data.reason,
            resaleId: condominium.resaleId,
            clientId: condominium.clientId,
          },
        });
      }),
    );
  }

  async listBlockListEntries(
    actor: Actor,
    condominiumId: string,
    query: PaginationQuery,
  ): Promise<Paginated<BlockListEntry>> {
    this.assertCanOperate(actor);
    const scope = resolveTenantScope(actor);
    const [items, total] = await this.prisma.withTenantContext(scope, (tx) =>
      Promise.all([
        tx.blockListEntry.findMany({
          where: { condominiumId },
          orderBy: { createdAt: 'desc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        tx.blockListEntry.count({ where: { condominiumId } }),
      ]),
    );
    return paginate(items, total, query);
  }

  private assertCanOperate(actor: Actor): void {
    if (!roleHasPermission(actor.role, PERMISSIONS.SECURITY_OPERATE)) {
      throw new ForbiddenException('Papel sem permissão para operar segurança');
    }
  }

  private assertCanOperatePanic(actor: Actor): void {
    if (
      !roleHasPermission(actor.role, PERMISSIONS.GATEHOUSE_OPERATE) &&
      !roleHasPermission(actor.role, PERMISSIONS.SECURITY_OPERATE)
    ) {
      throw new ForbiddenException('Papel sem permissão para o botão de pânico');
    }
  }

}
