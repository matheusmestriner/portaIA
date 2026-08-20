import { UserRole } from '@prisma/client';
import type { TenantScope } from '../../prisma/prisma.service';

interface ScopedUser {
  role: UserRole;
  resaleId: string | null;
  clientId: string | null;
  condominiumId: string | null;
}

/**
 * Derives the Postgres RLS scope for a user strictly from their persisted
 * role/tenant assignment — never from anything the client sends. This is
 * the single source of truth consumed by PrismaService.withTenantContext.
 */
export function resolveTenantScope(user: ScopedUser): TenantScope {
  switch (user.role) {
    case UserRole.SUPER_ADMIN:
      return {};
    case UserRole.RESALE_ADMIN:
    case UserRole.RESALE_OPERATOR:
      return { resaleId: user.resaleId };
    case UserRole.CLIENT_ADMIN:
    case UserRole.CLIENT_OPERATOR:
      return { resaleId: user.resaleId, clientId: user.clientId };
    case UserRole.CONDO_MANAGER:
    case UserRole.CONDO_OPERATOR:
      return { resaleId: user.resaleId, clientId: user.clientId, condominiumId: user.condominiumId };
    default:
      return { resaleId: user.resaleId, clientId: user.clientId, condominiumId: user.condominiumId };
  }
}
