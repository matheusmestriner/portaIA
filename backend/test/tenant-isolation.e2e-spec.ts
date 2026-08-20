import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Proves the Row-Level Security policies from
 * prisma/migrations/20260814000000_init_tenancy/migration.sql actually
 * block cross-tenant reads at the database layer, independent of any
 * application-level check. Requires a real PostgreSQL instance (see
 * DATABASE_URL) with migrations already applied.
 */
describe('Tenant isolation (RLS)', () => {
  // Must use the restricted `portalia_app` role, not the migrations
  // superuser — superusers bypass RLS regardless of FORCE ROW LEVEL SECURITY.
  const prisma = new PrismaService(process.env.APP_DATABASE_URL);

  let resaleA: { id: string };
  let resaleB: { id: string };
  let clientA: { id: string };
  let clientB: { id: string };
  let condoA: { id: string };
  let condoB: { id: string };

  beforeAll(async () => {
    await prisma.$connect();

    resaleA = await prisma.resale.create({ data: { name: 'Revenda A', slug: 'revenda-a-it' } });
    resaleB = await prisma.resale.create({ data: { name: 'Revenda B', slug: 'revenda-b-it' } });

    clientA = await prisma.client.create({
      data: { name: 'Cliente A', slug: 'cliente-a-it', resaleId: resaleA.id },
    });
    clientB = await prisma.client.create({
      data: { name: 'Cliente B', slug: 'cliente-b-it', resaleId: resaleB.id },
    });

    condoA = await prisma.condominium.create({
      data: { name: 'Condomínio A', slug: 'condo-a-it', clientId: clientA.id, resaleId: resaleA.id },
    });
    condoB = await prisma.condominium.create({
      data: { name: 'Condomínio B', slug: 'condo-b-it', clientId: clientB.id, resaleId: resaleB.id },
    });
  });

  afterAll(async () => {
    await prisma.condominium.deleteMany({ where: { id: { in: [condoA.id, condoB.id] } } });
    await prisma.client.deleteMany({ where: { id: { in: [clientA.id, clientB.id] } } });
    await prisma.resale.deleteMany({ where: { id: { in: [resaleA.id, resaleB.id] } } });
    await prisma.$disconnect();
  });

  it('a super admin (no scope) sees every tenant', async () => {
    const condos = await prisma.withTenantContext({}, (tx) =>
      tx.condominium.findMany({ where: { id: { in: [condoA.id, condoB.id] } } }),
    );
    expect(condos.map((c) => c.id).sort()).toEqual([condoA.id, condoB.id].sort());
  });

  it('a resale-scoped session only sees its own resale tree', async () => {
    const condos = await prisma.withTenantContext({ resaleId: resaleA.id }, (tx) =>
      tx.condominium.findMany({ where: { id: { in: [condoA.id, condoB.id] } } }),
    );
    expect(condos.map((c) => c.id)).toEqual([condoA.id]);
  });

  it('a client-scoped session cannot read another client in the same resale tree', async () => {
    // clientC belongs to resaleA, same as clientA, to prove client-level
    // scoping is enforced even within the same resale.
    const clientC = await prisma.client.create({
      data: { name: 'Cliente C', slug: 'cliente-c-it', resaleId: resaleA.id },
    });
    const condoC = await prisma.condominium.create({
      data: { name: 'Condomínio C', slug: 'condo-c-it', clientId: clientC.id, resaleId: resaleA.id },
    });

    try {
      const condos = await prisma.withTenantContext(
        { resaleId: resaleA.id, clientId: clientA.id },
        (tx) => tx.condominium.findMany({ where: { id: { in: [condoA.id, condoC.id] } } }),
      );
      expect(condos.map((c) => c.id)).toEqual([condoA.id]);
    } finally {
      await prisma.condominium.delete({ where: { id: condoC.id } });
      await prisma.client.delete({ where: { id: clientC.id } });
    }
  });

  it('a condominium-scoped session cannot read a sibling condominium', async () => {
    const condoA2 = await prisma.condominium.create({
      data: { name: 'Condomínio A2', slug: 'condo-a2-it', clientId: clientA.id, resaleId: resaleA.id },
    });

    try {
      const condos = await prisma.withTenantContext(
        { resaleId: resaleA.id, clientId: clientA.id, condominiumId: condoA.id },
        (tx) => tx.condominium.findMany({ where: { id: { in: [condoA.id, condoA2.id] } } }),
      );
      expect(condos.map((c) => c.id)).toEqual([condoA.id]);
    } finally {
      await prisma.condominium.delete({ where: { id: condoA2.id } });
    }
  });

  it('rejects a condominium whose resale_id does not match its parent client', async () => {
    await expect(
      prisma.condominium.create({
        data: {
          name: 'Condomínio Inconsistente',
          slug: 'condo-bad-it',
          clientId: clientA.id,
          resaleId: resaleB.id, // wrong on purpose: clientA belongs to resaleA
        },
      }),
    ).rejects.toThrow();
  });

  it('blocks a direct write across the raw client connection when scoped', async () => {
    // Even a raw update (not going through use-case checks) must be
    // blocked by RLS when the session is scoped to a different tenant.
    await prisma.withTenantContext({ resaleId: resaleB.id }, async (tx: PrismaClient) => {
      const result = await tx.condominium.updateMany({
        where: { id: condoA.id },
        data: { name: 'Hacked' },
      });
      expect(result.count).toBe(0);
    });

    const untouched = await prisma.condominium.findUniqueOrThrow({ where: { id: condoA.id } });
    expect(untouched.name).toBe('Condomínio A');
  });
});
