import { Test, type TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { CondominialService } from '../src/condominial/condominial.service';
import type { Actor } from '../src/auth/actor';

describe('Condominial core (integration)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let service: CondominialService;

  let resaleA: { id: string };
  let resaleB: { id: string };
  let clientA: { id: string };
  let clientB: { id: string };
  let condoA: { id: string };
  let condoB: { id: string };

  let clientAdminA: Actor;
  let condoManagerA: Actor;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    prisma = moduleRef.get(PrismaService);
    service = moduleRef.get(CondominialService);
    await prisma.$connect();

    resaleA = await prisma.resale.create({ data: { name: 'Revenda Cond A', slug: 'revenda-cond-a-it' } });
    resaleB = await prisma.resale.create({ data: { name: 'Revenda Cond B', slug: 'revenda-cond-b-it' } });
    clientA = await prisma.client.create({
      data: { name: 'Cliente Cond A', slug: 'cliente-cond-a-it', resaleId: resaleA.id },
    });
    clientB = await prisma.client.create({
      data: { name: 'Cliente Cond B', slug: 'cliente-cond-b-it', resaleId: resaleB.id },
    });
    condoA = await prisma.condominium.create({
      data: { name: 'Condo Cond A', slug: 'condo-cond-a-it', clientId: clientA.id, resaleId: resaleA.id },
    });
    condoB = await prisma.condominium.create({
      data: { name: 'Condo Cond B', slug: 'condo-cond-b-it', clientId: clientB.id, resaleId: resaleB.id },
    });

    clientAdminA = {
      id: 'actor-client-admin-a',
      role: UserRole.CLIENT_ADMIN,
      resaleId: resaleA.id,
      clientId: clientA.id,
      condominiumId: null,
      mustChangePassword: false,
    };
    condoManagerA = {
      id: 'actor-condo-manager-a',
      role: UserRole.CONDO_MANAGER,
      resaleId: resaleA.id,
      clientId: clientA.id,
      condominiumId: condoA.id,
      mustChangePassword: false,
    };
  });

  afterAll(async () => {
    await prisma.vehicle.deleteMany({ where: { condominiumId: { in: [condoA.id, condoB.id] } } });
    await prisma.resident.deleteMany({ where: { condominiumId: { in: [condoA.id, condoB.id] } } });
    await prisma.provider.deleteMany({ where: { condominiumId: { in: [condoA.id, condoB.id] } } });
    await prisma.unit.deleteMany({ where: { condominiumId: { in: [condoA.id, condoB.id] } } });
    await prisma.condominium.deleteMany({ where: { id: { in: [condoA.id, condoB.id] } } });
    await prisma.client.deleteMany({ where: { id: { in: [clientA.id, clientB.id] } } });
    await prisma.resale.deleteMany({ where: { id: { in: [resaleA.id, resaleB.id] } } });
    await prisma.$disconnect();
    await moduleRef.close();
  });

  it('creates a unit, resident, vehicle and provider with denormalized tenant chain', async () => {
    const unit = await service.createUnit(clientAdminA, { condominiumId: condoA.id, identifier: '101' });
    expect(unit.resaleId).toBe(resaleA.id);
    expect(unit.clientId).toBe(clientA.id);
    expect(unit.condominiumId).toBe(condoA.id);

    const { resident, temporaryPassword } = await service.createResident(clientAdminA, {
      unitId: unit.id,
      name: 'Ana',
      isPrimary: true,
    });
    expect(resident.condominiumId).toBe(condoA.id);
    // Sem email informado, não há login do app do morador possível ainda —
    // nenhuma senha temporária é gerada.
    expect(temporaryPassword).toBeNull();

    const vehicle = await service.createVehicle(clientAdminA, { unitId: unit.id, plate: 'abc1d23' });
    expect(vehicle.plate).toBe('ABC1D23');
    expect(vehicle.condominiumId).toBe(condoA.id);

    const provider = await service.createProvider(clientAdminA, {
      condominiumId: condoA.id,
      name: 'Dedetizadora X',
      document: '12345678000199',
    });
    expect(provider.condominiumId).toBe(condoA.id);
  });

  it('denies a role without CONDOMINIUM_MANAGE permission', async () => {
    const reportOnlyActor: Actor = {
      id: 'actor-client-operator-a',
      role: UserRole.CLIENT_OPERATOR,
      resaleId: resaleA.id,
      clientId: clientA.id,
      condominiumId: null,
      mustChangePassword: false,
    };
    await expect(
      service.createUnit(reportOnlyActor, { condominiumId: condoA.id, identifier: '999' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it("blocks a client admin from creating a unit under another client's condominium", async () => {
    await expect(service.createUnit(clientAdminA, { condominiumId: condoB.id, identifier: '1' })).rejects.toThrow();
  });

  it('lets a condo-scoped operator manage only their own condominium', async () => {
    const unit = await service.createUnit(condoManagerA, { condominiumId: condoA.id, identifier: '202' });
    expect(unit.condominiumId).toBe(condoA.id);

    await expect(service.createUnit(condoManagerA, { condominiumId: condoB.id, identifier: '1' })).rejects.toThrow();
  });

  it('records an audit log entry for a successful write and a failed one', async () => {
    await service.createUnit(clientAdminA, { condominiumId: condoA.id, identifier: '303' });
    const successLogs = await prisma.auditLog.findMany({
      where: { action: 'unit.create', targetType: 'Unit', tenantClientId: clientA.id },
    });
    expect(successLogs.length).toBeGreaterThan(0);

    await expect(
      service.createUnit(clientAdminA, { condominiumId: condoB.id, identifier: 'audit-fail' }),
    ).rejects.toThrow();
    const failureLogs = await prisma.auditLog.findMany({
      where: { action: 'unit.create', targetType: 'Unit', result: 'FAILURE', actorUserId: clientAdminA.id },
    });
    expect(failureLogs.length).toBeGreaterThan(0);
  });
});
