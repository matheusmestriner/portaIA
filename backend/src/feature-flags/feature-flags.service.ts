import { ForbiddenException, Injectable } from '@nestjs/common';
import { FeatureFlagScope, UserRole, type FeatureFlag } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { TenantScope } from '../prisma/prisma.service';
import { PERMISSIONS, roleHasPermission } from '../auth/rbac/permissions';
import { resolveWritableScopeId } from '../auth/rbac/scope-authorization';
import type { Actor } from '../auth/actor';

@Injectable()
export class FeatureFlagsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolves the effective value of a flag for a tenant, most-specific
   * scope wins: CONDOMINIUM > CLIENT > RESALE > GLOBAL. Defaults to false
   * (disabled) when no row exists at any level, so a forgotten flag never
   * silently turns a feature on.
   */
  async isEnabled(key: string, scope: TenantScope): Promise<boolean> {
    const candidates: Array<{ scope: FeatureFlagScope; scopeId: string }> = [];
    if (scope.condominiumId) {
      candidates.push({ scope: FeatureFlagScope.CONDOMINIUM, scopeId: scope.condominiumId });
    }
    if (scope.clientId) {
      candidates.push({ scope: FeatureFlagScope.CLIENT, scopeId: scope.clientId });
    }
    if (scope.resaleId) {
      candidates.push({ scope: FeatureFlagScope.RESALE, scopeId: scope.resaleId });
    }
    candidates.push({ scope: FeatureFlagScope.GLOBAL, scopeId: '' });

    const rows = await this.prisma.featureFlag.findMany({
      where: { key, OR: candidates.map((c) => ({ scope: c.scope, scopeId: c.scopeId })) },
    });

    for (const candidate of candidates) {
      const row = rows.find((r) => r.scope === candidate.scope && r.scopeId === candidate.scopeId);
      if (row) {
        return row.enabled;
      }
    }
    return false;
  }

  /**
   * feature_flags has no RLS (see migration comment — resolving "effective"
   * needs multi-level reads a per-row policy can't express), so the
   * tenant-tree restriction for a non-super-admin has to happen here in
   * application code instead. Only SUPER_ADMIN and RESALE_ADMIN currently
   * hold FEATURE_FLAG_MANAGE — a resale admin must only ever see GLOBAL
   * flags plus flags scoped to their own resale/client/condominium tree,
   * never another resale's.
   */
  async listForScope(actor: Actor): Promise<FeatureFlag[]> {
    if (!roleHasPermission(actor.role, PERMISSIONS.FEATURE_FLAG_MANAGE)) {
      throw new ForbiddenException('Papel sem permissão para gerenciar feature flags');
    }
    if (actor.role === UserRole.SUPER_ADMIN) {
      return this.prisma.featureFlag.findMany({ orderBy: [{ key: 'asc' }, { scope: 'asc' }] });
    }

    const [clients, condominiums] = await Promise.all([
      this.prisma.client.findMany({ where: { resaleId: actor.resaleId as string }, select: { id: true } }),
      this.prisma.condominium.findMany({ where: { resaleId: actor.resaleId as string }, select: { id: true } }),
    ]);

    return this.prisma.featureFlag.findMany({
      where: {
        OR: [
          { scope: FeatureFlagScope.GLOBAL },
          { scope: FeatureFlagScope.RESALE, scopeId: actor.resaleId as string },
          { scope: FeatureFlagScope.CLIENT, scopeId: { in: clients.map((c) => c.id) } },
          { scope: FeatureFlagScope.CONDOMINIUM, scopeId: { in: condominiums.map((c) => c.id) } },
        ],
      },
      orderBy: [{ key: 'asc' }, { scope: 'asc' }],
    });
  }

  async setFlag(
    actor: Actor,
    key: string,
    targetScope: FeatureFlagScope,
    requestedScopeId: string | undefined,
    enabled: boolean,
  ): Promise<FeatureFlag> {
    if (!roleHasPermission(actor.role, PERMISSIONS.FEATURE_FLAG_MANAGE)) {
      throw new ForbiddenException('Papel sem permissão para gerenciar feature flags');
    }
    const scopeId = await resolveWritableScopeId(actor, targetScope, requestedScopeId, this.prisma);

    return this.prisma.featureFlag.upsert({
      where: { key_scope_scopeId: { key, scope: targetScope, scopeId } },
      create: { key, scope: targetScope, scopeId, enabled },
      update: { enabled },
    });
  }
}
