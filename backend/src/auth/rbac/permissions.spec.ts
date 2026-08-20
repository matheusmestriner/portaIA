import { UserRole } from '@prisma/client';
import { PERMISSIONS, roleHasPermission } from './permissions';

describe('roleHasPermission', () => {
  it('grants super admin every permission in the catalog', () => {
    for (const permission of Object.values(PERMISSIONS)) {
      expect(roleHasPermission(UserRole.SUPER_ADMIN, permission)).toBe(true);
    }
  });

  it('does not let a condo operator manage condominiums', () => {
    expect(roleHasPermission(UserRole.CONDO_OPERATOR, PERMISSIONS.CONDOMINIUM_MANAGE)).toBe(false);
  });

  it('lets a condo operator operate the gatehouse', () => {
    expect(roleHasPermission(UserRole.CONDO_OPERATOR, PERMISSIONS.GATEHOUSE_OPERATE)).toBe(true);
  });

  it('does not let a client admin manage the platform', () => {
    expect(roleHasPermission(UserRole.CLIENT_ADMIN, PERMISSIONS.PLATFORM_MANAGE)).toBe(false);
  });

  it('does not let a resale operator manage users', () => {
    expect(roleHasPermission(UserRole.RESALE_OPERATOR, PERMISSIONS.USER_MANAGE)).toBe(false);
  });

  it('lets a client admin create condominiums under their own client', () => {
    expect(roleHasPermission(UserRole.CLIENT_ADMIN, PERMISSIONS.CLIENT_MANAGE)).toBe(true);
  });

  it('does not let a condo operator manage communications (only the condo manager can)', () => {
    expect(roleHasPermission(UserRole.CONDO_OPERATOR, PERMISSIONS.COMMUNICATION_MANAGE)).toBe(false);
    expect(roleHasPermission(UserRole.CONDO_MANAGER, PERMISSIONS.COMMUNICATION_MANAGE)).toBe(true);
  });

  // Trava a regressão que já aconteceu duas vezes com este papel: a lista
  // era escrita à mão e ficava para trás quando ALL_CONDO_LEVEL crescia.
  it('gives a condo operator every condo-level permission, including reports', () => {
    for (const permission of [
      PERMISSIONS.GATEHOUSE_OPERATE,
      PERMISSIONS.SECURITY_OPERATE,
      PERMISSIONS.TELEPHONY_OPERATE,
      PERMISSIONS.REPORTS_VIEW,
    ]) {
      expect(roleHasPermission(UserRole.CONDO_OPERATOR, permission)).toBe(true);
    }
  });

  it('lets both condo-level roles operate telephony, but not a client admin', () => {
    expect(roleHasPermission(UserRole.CONDO_OPERATOR, PERMISSIONS.TELEPHONY_OPERATE)).toBe(true);
    expect(roleHasPermission(UserRole.CONDO_MANAGER, PERMISSIONS.TELEPHONY_OPERATE)).toBe(true);
    expect(roleHasPermission(UserRole.CLIENT_ADMIN, PERMISSIONS.TELEPHONY_OPERATE)).toBe(false);
  });
});
