import { UserRole } from '@prisma/client';
import { canProvisionRole } from './role-hierarchy';

describe('canProvisionRole', () => {
  it('never allows provisioning another super admin through this path', () => {
    expect(canProvisionRole(UserRole.SUPER_ADMIN, UserRole.SUPER_ADMIN)).toBe(false);
  });

  it('lets a super admin provision any non-super-admin role', () => {
    expect(canProvisionRole(UserRole.SUPER_ADMIN, UserRole.CONDO_OPERATOR)).toBe(true);
    expect(canProvisionRole(UserRole.SUPER_ADMIN, UserRole.RESALE_ADMIN)).toBe(true);
  });

  it('lets a resale admin provision client- and condo-level roles', () => {
    expect(canProvisionRole(UserRole.RESALE_ADMIN, UserRole.CLIENT_ADMIN)).toBe(true);
    expect(canProvisionRole(UserRole.RESALE_ADMIN, UserRole.CONDO_OPERATOR)).toBe(true);
  });

  it('does not let a client admin provision a resale-level role', () => {
    expect(canProvisionRole(UserRole.CLIENT_ADMIN, UserRole.RESALE_OPERATOR)).toBe(false);
  });

  it('only lets a condo manager provision condo-level roles', () => {
    expect(canProvisionRole(UserRole.CONDO_MANAGER, UserRole.CONDO_OPERATOR)).toBe(true);
    expect(canProvisionRole(UserRole.CONDO_MANAGER, UserRole.CLIENT_OPERATOR)).toBe(false);
  });
});
