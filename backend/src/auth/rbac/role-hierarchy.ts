import { UserRole } from '@prisma/client';

/**
 * Depth in the tenancy tree each role is scoped to: 0 = platform (super
 * admin, unscoped), 1 = resale, 2 = client, 3 = condominium. Used by user
 * management to enforce that an actor can only provision accounts at their
 * own depth or deeper — never a role above their own scope, and never
 * SUPER_ADMIN (that account is provisioned exclusively via the bootstrap
 * CLI, see BootstrapSuperAdminUseCase).
 */
export const ROLE_DEPTH: Record<UserRole, number> = {
  SUPER_ADMIN: 0,
  RESALE_ADMIN: 1,
  RESALE_OPERATOR: 1,
  CLIENT_ADMIN: 2,
  CLIENT_OPERATOR: 2,
  CONDO_MANAGER: 3,
  CONDO_OPERATOR: 3,
};

export function canProvisionRole(actorRole: UserRole, targetRole: UserRole): boolean {
  if (targetRole === UserRole.SUPER_ADMIN) {
    return false;
  }
  return ROLE_DEPTH[targetRole] >= ROLE_DEPTH[actorRole];
}
