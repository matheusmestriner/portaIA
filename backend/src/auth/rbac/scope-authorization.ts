import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { FeatureFlagScope } from '@prisma/client';
import { ROLE_DEPTH } from './role-hierarchy';
import { resolveTenantScope } from './tenant-scope.resolver';
import type { Actor } from '../actor';
import type { PrismaService } from '../../prisma/prisma.service';

const SCOPE_DEPTH: Record<FeatureFlagScope, number> = {
  GLOBAL: 0,
  RESALE: 1,
  CLIENT: 2,
  CONDOMINIUM: 3,
};

/**
 * Shared by feature-flags and white-label config, which both resolve
 * "effective value" across the same GLOBAL > RESALE > CLIENT > CONDOMINIUM
 * hierarchy. An actor may only write at their own depth or deeper — never
 * above it, and only SUPER_ADMIN may touch GLOBAL. When the actor is above
 * the target depth (e.g. a resale admin setting a client-level value), the
 * requested id is never trusted at face value: it's validated through an
 * RLS-scoped lookup, so it's provably inside the actor's own tenant tree.
 *
 * Returns the validated scopeId ('' for GLOBAL).
 */
export async function resolveWritableScopeId(
  actor: Actor,
  targetScope: FeatureFlagScope,
  requestedScopeId: string | undefined,
  prisma: PrismaService,
): Promise<string> {
  const actorDepth = ROLE_DEPTH[actor.role];
  const targetDepth = SCOPE_DEPTH[targetScope];

  if (targetDepth < actorDepth) {
    throw new ForbiddenException(`Papel ${actor.role} não pode configurar no escopo ${targetScope}`);
  }

  if (targetScope === FeatureFlagScope.GLOBAL) {
    return '';
  }

  const scope = resolveTenantScope(actor);

  if (targetDepth === actorDepth) {
    const ownId =
      targetScope === FeatureFlagScope.RESALE
        ? actor.resaleId
        : targetScope === FeatureFlagScope.CLIENT
          ? actor.clientId
          : actor.condominiumId;
    if (!ownId) {
      throw new ForbiddenException('Ator sem tenant próprio para este escopo');
    }
    return ownId;
  }

  if (!requestedScopeId) {
    throw new BadRequestException('scopeId é obrigatório para este ator/escopo');
  }

  if (targetScope === FeatureFlagScope.RESALE) {
    const resale = await prisma.withTenantContext(scope, (tx) =>
      tx.resale.findUniqueOrThrow({ where: { id: requestedScopeId } }),
    );
    return resale.id;
  }
  if (targetScope === FeatureFlagScope.CLIENT) {
    const client = await prisma.withTenantContext(scope, (tx) =>
      tx.client.findUniqueOrThrow({ where: { id: requestedScopeId } }),
    );
    return client.id;
  }
  const condominium = await prisma.withTenantContext(scope, (tx) =>
    tx.condominium.findUniqueOrThrow({ where: { id: requestedScopeId } }),
  );
  return condominium.id;
}
