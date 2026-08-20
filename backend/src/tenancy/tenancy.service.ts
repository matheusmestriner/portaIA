import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { UserRole, type Client, type Condominium, type Resale } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { auditedOperation } from '../common/audit/audited-operation';
import { PERMISSIONS, roleHasPermission } from '../auth/rbac/permissions';
import { resolveTenantScope } from '../auth/rbac/tenant-scope.resolver';
import { paginate, type PaginationQuery, type Paginated } from '../common/http/pagination';
import type { Actor } from '../auth/actor';
import {
  createClientSchema,
  createCondominiumSchema,
  createResaleSchema,
  type CreateClientInput,
  type CreateCondominiumInput,
  type CreateResaleInput,
} from './dto';

@Injectable()
export class TenancyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ---------------------------------------------------------------------
  // Resale (top of the hierarchy — super admin only)
  // ---------------------------------------------------------------------

  async createResale(actor: Actor, input: CreateResaleInput): Promise<Resale> {
    this.assertPermission(actor, PERMISSIONS.PLATFORM_MANAGE);
    const data = createResaleSchema.parse(input);
    const scope = resolveTenantScope(actor);

    return auditedOperation(this.audit, actor, scope, 'resale.create', 'Resale', () =>
      this.prisma.withTenantContext(scope, (tx) => tx.resale.create({ data })),
    );
  }

  async listResales(actor: Actor, query: PaginationQuery): Promise<Paginated<Resale>> {
    this.assertPermission(actor, PERMISSIONS.PLATFORM_MANAGE);
    const scope = resolveTenantScope(actor);
    const [items, total] = await this.prisma.withTenantContext(scope, (tx) =>
      Promise.all([
        tx.resale.findMany({
          orderBy: { name: 'asc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        tx.resale.count(),
      ]),
    );
    return paginate(items, total, query);
  }

  // ---------------------------------------------------------------------
  // Client (under a Resale)
  // ---------------------------------------------------------------------

  async createClient(actor: Actor, input: CreateClientInput): Promise<Client> {
    this.assertPermission(actor, PERMISSIONS.RESALE_MANAGE);
    const data = createClientSchema.parse(input);
    const scope = resolveTenantScope(actor);

    // A tenant id supplied by the caller never grants authorization on its
    // own: a scoped resale admin always creates under their own resale,
    // regardless of what resaleId the request body claims. Only a super
    // admin (unscoped) must say explicitly which resale they mean.
    const resaleId = actor.role === UserRole.SUPER_ADMIN ? data.resaleId : actor.resaleId;
    if (!resaleId) {
      throw new BadRequestException('resaleId é obrigatório para este ator');
    }

    return auditedOperation(this.audit, actor, scope, 'client.create', 'Client', () =>
      this.prisma.withTenantContext(scope, (tx) =>
        tx.client.create({ data: { resaleId, name: data.name, slug: data.slug } }),
      ),
    );
  }

  async listClients(actor: Actor, resaleId: string, query: PaginationQuery): Promise<Paginated<Client>> {
    this.assertPermission(actor, PERMISSIONS.REPORTS_VIEW);
    const scope = resolveTenantScope(actor);
    const [items, total] = await this.prisma.withTenantContext(scope, (tx) =>
      Promise.all([
        tx.client.findMany({
          where: { resaleId },
          orderBy: { name: 'asc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        tx.client.count({ where: { resaleId } }),
      ]),
    );
    return paginate(items, total, query);
  }

  // ---------------------------------------------------------------------
  // Condominium (under a Client)
  // ---------------------------------------------------------------------

  async createCondominium(actor: Actor, input: CreateCondominiumInput): Promise<Condominium> {
    this.assertPermission(actor, PERMISSIONS.CLIENT_MANAGE);
    const data = createCondominiumSchema.parse(input);
    const scope = resolveTenantScope(actor);

    const isClientScopedActor = actor.role === UserRole.CLIENT_ADMIN || actor.role === UserRole.CLIENT_OPERATOR;
    const clientId = isClientScopedActor ? actor.clientId : data.clientId;
    if (!clientId) {
      throw new BadRequestException('clientId é obrigatório para este ator');
    }

    return auditedOperation(this.audit, actor, scope, 'condominium.create', 'Condominium', async () => {
      const client = await this.prisma.withTenantContext(scope, (tx) =>
        tx.client.findUniqueOrThrow({ where: { id: clientId } }),
      );
      return this.prisma.withTenantContext(scope, (tx) =>
        tx.condominium.create({
          data: { clientId: client.id, resaleId: client.resaleId, name: data.name, slug: data.slug },
        }),
      );
    });
  }

  async listCondominiums(actor: Actor, clientId: string, query: PaginationQuery): Promise<Paginated<Condominium>> {
    this.assertPermission(actor, PERMISSIONS.REPORTS_VIEW);
    const scope = resolveTenantScope(actor);
    const [items, total] = await this.prisma.withTenantContext(scope, (tx) =>
      Promise.all([
        tx.condominium.findMany({
          where: { clientId },
          orderBy: { name: 'asc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        tx.condominium.count({ where: { clientId } }),
      ]),
    );
    return paginate(items, total, query);
  }

  private assertPermission(actor: Actor, permission: (typeof PERMISSIONS)[keyof typeof PERMISSIONS]): void {
    if (!roleHasPermission(actor.role, permission)) {
      throw new ForbiddenException(`Papel sem a permissão exigida: ${permission}`);
    }
  }

}
