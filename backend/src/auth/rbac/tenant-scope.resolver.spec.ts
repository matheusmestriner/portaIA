import { UserRole } from '@prisma/client';
import { resolveTenantScope } from './tenant-scope.resolver';

describe('resolveTenantScope', () => {
  it('gives a super admin no restriction at any level', () => {
    expect(
      resolveTenantScope({ role: UserRole.SUPER_ADMIN, resaleId: null, clientId: null, condominiumId: null }),
    ).toEqual({});
  });

  it('scopes a resale admin to only their resale', () => {
    expect(
      resolveTenantScope({ role: UserRole.RESALE_ADMIN, resaleId: 'r1', clientId: null, condominiumId: null }),
    ).toEqual({ resaleId: 'r1' });
  });

  it('scopes a client admin to resale + client', () => {
    expect(
      resolveTenantScope({ role: UserRole.CLIENT_ADMIN, resaleId: 'r1', clientId: 'c1', condominiumId: null }),
    ).toEqual({ resaleId: 'r1', clientId: 'c1' });
  });

  it('scopes a condo operator to all three levels', () => {
    expect(
      resolveTenantScope({ role: UserRole.CONDO_OPERATOR, resaleId: 'r1', clientId: 'c1', condominiumId: 'd1' }),
    ).toEqual({ resaleId: 'r1', clientId: 'c1', condominiumId: 'd1' });
  });
});
