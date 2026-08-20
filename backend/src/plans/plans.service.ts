import { ForbiddenException, Injectable } from '@nestjs/common';
import { type Plan, type Resale } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { auditedOperation } from '../common/audit/audited-operation';
import { PERMISSIONS, roleHasPermission } from '../auth/rbac/permissions';
import { resolveTenantScope } from '../auth/rbac/tenant-scope.resolver';
import { paginate, type PaginationQuery, type Paginated } from '../common/http/pagination';
import type { Actor } from '../auth/actor';
import { assignPlanSchema, createPlanSchema, type AssignPlanInput, type CreatePlanInput } from './dto';

/** Plans/provisioning is a platform-catalog concern — every method here is super-admin only. */
@Injectable()
export class PlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async createPlan(actor: Actor, input: CreatePlanInput): Promise<Plan> {
    this.assertPlatformManage(actor);
    const data = createPlanSchema.parse(input);
    const scope = resolveTenantScope(actor);

    return auditedOperation(this.audit, actor, scope, 'plan.create', 'Plan', () =>
      this.prisma.plan.create({
        data: { key: data.key, name: data.name, description: data.description, modules: data.modules },
      }),
    );
  }

  async listPlans(actor: Actor, query: PaginationQuery): Promise<Paginated<Plan>> {
    this.assertPlatformManage(actor);
    const [items, total] = await Promise.all([
      this.prisma.plan.findMany({
        orderBy: { name: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.plan.count(),
    ]);
    return paginate(items, total, query);
  }

  /** "Provisionamento": attaches (or detaches, planId=null) a plan to a resale. */
  async assignPlanToResale(actor: Actor, input: AssignPlanInput): Promise<Resale> {
    this.assertPlatformManage(actor);
    const data = assignPlanSchema.parse(input);
    const scope = resolveTenantScope(actor);

    return auditedOperation(this.audit, actor, scope, 'resale.assign_plan', 'Resale', async () => {
      if (data.planId) {
        await this.prisma.plan.findUniqueOrThrow({ where: { id: data.planId } });
      }
      return this.prisma.resale.update({ where: { id: data.resaleId }, data: { planId: data.planId } });
    });
  }

  private assertPlatformManage(actor: Actor): void {
    if (!roleHasPermission(actor.role, PERMISSIONS.PLATFORM_MANAGE)) {
      throw new ForbiddenException('Papel sem permissão para gerenciar planos/provisionamento');
    }
  }

}
