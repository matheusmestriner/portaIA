import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { UserRole, type User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { auditedOperation } from '../common/audit/audited-operation';
import { PasswordHasherService } from '../auth/password-hasher.service';
import { PERMISSIONS, roleHasPermission } from '../auth/rbac/permissions';
import { ROLE_DEPTH, canProvisionRole } from '../auth/rbac/role-hierarchy';
import { resolveTenantScope } from '../auth/rbac/tenant-scope.resolver';
import { paginate, type PaginationQuery, type Paginated } from '../common/http/pagination';
import type { Actor } from '../auth/actor';
import { createUserSchema, type CreateUserInput } from './dto';

interface EffectiveScope {
  resaleId: string | null;
  clientId: string | null;
  condominiumId: string | null;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordHasher: PasswordHasherService,
    private readonly audit: AuditService,
  ) {}

  async createUser(actor: Actor, input: CreateUserInput): Promise<User> {
    if (!roleHasPermission(actor.role, PERMISSIONS.USER_MANAGE)) {
      throw new ForbiddenException('Papel sem permissão para gerenciar usuários');
    }
    const data = createUserSchema.parse(input);
    if (!canProvisionRole(actor.role, data.role)) {
      throw new ForbiddenException(
        `Papel ${actor.role} não pode provisionar contas com papel ${data.role}`,
      );
    }

    const scope = resolveTenantScope(actor);
    const effective = await this.resolveEffectiveScope(actor, data.role, scope, data);
    const passwordHash = await this.passwordHasher.hash(data.password);

    return auditedOperation(this.audit, actor, scope, 'user.create', 'User', () =>
      this.prisma.withTenantContext(scope, (tx) =>
        tx.user.create({
          data: {
            email: data.email.toLowerCase().trim(),
            passwordHash,
            role: data.role,
            resaleId: effective.resaleId,
            clientId: effective.clientId,
            condominiumId: effective.condominiumId,
            mustChangePassword: true,
          },
        }),
      ),
    );
  }

  async listUsers(actor: Actor, query: PaginationQuery): Promise<Paginated<User>> {
    if (!roleHasPermission(actor.role, PERMISSIONS.USER_MANAGE)) {
      throw new ForbiddenException('Papel sem permissão para gerenciar usuários');
    }
    const scope = resolveTenantScope(actor);
    const [items, total] = await this.prisma.withTenantContext(scope, (tx) =>
      Promise.all([
        tx.user.findMany({
          orderBy: { email: 'asc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        tx.user.count(),
      ]),
    );
    return paginate(items, total, query);
  }

  /**
   * Derives the tenant scope the new user is created under. A tenant id
   * supplied in the request body is only ever consulted when the actor's
   * own scope doesn't already fix that level — and even then it's
   * validated against the parent chain via a tenant-scoped lookup (so RLS
   * does double duty as the ownership check), never trusted on its own.
   */
  private async resolveEffectiveScope(
    actor: Actor,
    targetRole: UserRole,
    scope: ReturnType<typeof resolveTenantScope>,
    body: CreateUserInput,
  ): Promise<EffectiveScope> {
    const actorDepth = ROLE_DEPTH[actor.role];
    const targetDepth = ROLE_DEPTH[targetRole];

    const result: EffectiveScope = { resaleId: null, clientId: null, condominiumId: null };
    if (targetDepth < 1) {
      return result;
    }

    if (actorDepth >= 1) {
      result.resaleId = actor.resaleId;
    } else {
      if (!body.resaleId) {
        throw new BadRequestException('resaleId é obrigatório para este ator/papel');
      }
      result.resaleId = body.resaleId;
    }

    if (targetDepth < 2) {
      return result;
    }

    if (actorDepth >= 2) {
      result.clientId = actor.clientId;
    } else {
      if (!body.clientId) {
        throw new BadRequestException('clientId é obrigatório para este ator/papel');
      }
      const client = await this.prisma.withTenantContext(scope, (tx) =>
        tx.client.findUniqueOrThrow({ where: { id: body.clientId } }),
      );
      if (client.resaleId !== result.resaleId) {
        throw new BadRequestException('clientId não pertence ao resaleId resolvido');
      }
      result.clientId = client.id;
    }

    if (targetDepth < 3) {
      return result;
    }

    if (actorDepth >= 3) {
      result.condominiumId = actor.condominiumId;
    } else {
      if (!body.condominiumId) {
        throw new BadRequestException('condominiumId é obrigatório para este ator/papel');
      }
      const condominium = await this.prisma.withTenantContext(scope, (tx) =>
        tx.condominium.findUniqueOrThrow({ where: { id: body.condominiumId } }),
      );
      if (condominium.clientId !== result.clientId) {
        throw new BadRequestException('condominiumId não pertence ao clientId resolvido');
      }
      result.condominiumId = condominium.id;
    }

    return result;
  }

}
