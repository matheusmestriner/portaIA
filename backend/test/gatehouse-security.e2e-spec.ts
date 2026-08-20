import { Test, type TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { DeliveryStatus, KeyRecordStatus, UserRole } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { GatehouseService } from '../src/gatehouse/gatehouse.service';
import { SecurityService } from '../src/security/security.service';
import type { Actor } from '../src/auth/actor';

describe('Gatehouse + Security (integration)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let gatehouse: GatehouseService;
  let security: SecurityService;

  let resale: { id: string };
  let client: { id: string };
  let condoA: { id: string };
  let condoB: { id: string };
  let unitA: { id: string };

  let condoOperatorA: Actor;
  let condoManagerA: Actor;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    prisma = moduleRef.get(PrismaService);
    gatehouse = moduleRef.get(GatehouseService);
    security = moduleRef.get(SecurityService);
    await prisma.$connect();

    resale = await prisma.resale.create({ data: { name: 'Revenda GH', slug: 'revenda-gh-it' } });
    client = await prisma.client.create({ data: { name: 'Cliente GH', slug: 'cliente-gh-it', resaleId: resale.id } });
    condoA = await prisma.condominium.create({
      data: { name: 'Condo GH A', slug: 'condo-gh-a-it', clientId: client.id, resaleId: resale.id },
    });
    condoB = await prisma.condominium.create({
      data: { name: 'Condo GH B', slug: 'condo-gh-b-it', clientId: client.id, resaleId: resale.id },
    });
    unitA = await prisma.unit.create({
      data: { condominiumId: condoA.id, resaleId: resale.id, clientId: client.id, identifier: '101' },
    });

    condoOperatorA = {
      id: 'actor-gh-operator-a',
      role: UserRole.CONDO_OPERATOR,
      resaleId: resale.id,
      clientId: client.id,
      condominiumId: condoA.id,
      mustChangePassword: false,
    };
    condoManagerA = {
      id: 'actor-gh-manager-a',
      role: UserRole.CONDO_MANAGER,
      resaleId: resale.id,
      clientId: client.id,
      condominiumId: condoA.id,
      mustChangePassword: false,
    };
  });

  afterAll(async () => {
    await prisma.visitorAuthorization.deleteMany({ where: { condominiumId: { in: [condoA.id, condoB.id] } } });
    await prisma.visitor.deleteMany({ where: { condominiumId: { in: [condoA.id, condoB.id] } } });
    await prisma.delivery.deleteMany({ where: { condominiumId: { in: [condoA.id, condoB.id] } } });
    await prisma.keyRecord.deleteMany({ where: { condominiumId: { in: [condoA.id, condoB.id] } } });
    await prisma.occurrence.deleteMany({ where: { condominiumId: { in: [condoA.id, condoB.id] } } });
    await prisma.panicAlert.deleteMany({ where: { condominiumId: { in: [condoA.id, condoB.id] } } });
    await prisma.blockListEntry.deleteMany({ where: { condominiumId: { in: [condoA.id, condoB.id] } } });
    await prisma.unit.deleteMany({ where: { id: unitA.id } });
    await prisma.condominium.deleteMany({ where: { id: { in: [condoA.id, condoB.id] } } });
    await prisma.client.deleteMany({ where: { id: client.id } });
    await prisma.resale.deleteMany({ where: { id: resale.id } });
    await prisma.$disconnect();
    await moduleRef.close();
  });

  it('registers a visitor with an approved authorization window', async () => {
    const visitor = await gatehouse.registerVisitor(condoOperatorA, {
      unitId: unitA.id,
      name: 'Maria Visitante',
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 3600_000),
    });
    expect(visitor.condominiumId).toBe(condoA.id);

    const auths = await prisma.visitorAuthorization.findMany({ where: { visitorId: visitor.id } });
    expect(auths).toHaveLength(1);
    expect(auths[0].status).toBe('APPROVED');
  });

  it('creates a delivery awaiting pickup and never persists the code in plaintext', async () => {
    const { delivery, pickupCode } = await gatehouse.createDelivery(condoOperatorA, {
      unitId: unitA.id,
      description: 'Pacote Amazon',
    });
    expect(delivery.status).toBe(DeliveryStatus.PENDING);

    // A entrega persistida guarda só o HMAC e os 4 últimos dígitos: o código
    // em claro não existe em nenhuma coluna.
    const stored = await prisma.delivery.findUniqueOrThrow({ where: { id: delivery.id } });
    expect(JSON.stringify(stored)).not.toContain(pickupCode);
    expect(stored.pickupCodeHash).toBeTruthy();
    expect(stored.pickupCodeLast4).toBe(pickupCode.slice(-4));
  });

  it('issues a pickup credential and redeems the delivery by the numeric code', async () => {
    const issued = await gatehouse.createDelivery(condoOperatorA, {
      unitId: unitA.id,
      description: 'Encomenda com credencial',
    });
    expect(issued.pickupCode).toMatch(/^[0-9]{6}$/);
    expect(issued.qrPayload).toContain(issued.delivery.id);
    // O valor em claro nunca é persistido — só o HMAC.
    expect(issued.delivery.pickupCodeHash).not.toBe(issued.pickupCode);
    expect(issued.delivery.pickupCodeLast4).toBe(issued.pickupCode.slice(-4));

    const redeemed = await gatehouse.redeemDelivery(condoOperatorA, {
      credential: issued.pickupCode,
      pickedUpBy: 'Morador da 101',
    });
    expect(redeemed.id).toBe(issued.delivery.id);
    expect(redeemed.status).toBe(DeliveryStatus.COLLECTED);
    expect(redeemed.pickedUpBy).toBe('Morador da 101');

    // A mesma credencial não serve duas vezes.
    await expect(
      gatehouse.redeemDelivery(condoOperatorA, { credential: issued.pickupCode, pickedUpBy: 'Outra pessoa' }),
    ).rejects.toThrow();
  });

  it('redeems a delivery by the scanned QR payload', async () => {
    const issued = await gatehouse.createDelivery(condoOperatorA, {
      unitId: unitA.id,
      description: 'Encomenda com QR',
    });

    const redeemed = await gatehouse.redeemDelivery(condoOperatorA, {
      credential: issued.qrPayload,
      pickedUpBy: 'Morador via app',
    });
    expect(redeemed.id).toBe(issued.delivery.id);
    expect(redeemed.status).toBe(DeliveryStatus.COLLECTED);
  });

  it('rejects an unknown credential', async () => {
    await expect(
      gatehouse.redeemDelivery(condoOperatorA, { credential: '000000', pickedUpBy: 'Ninguém' }),
    ).rejects.toThrow();
  });

  it('checks out and returns a key, rejecting a double checkout', async () => {
    const key = await gatehouse.createKeyRecord(condoOperatorA, { unitId: unitA.id, label: 'Chave reserva' });
    expect(key.status).toBe(KeyRecordStatus.WITH_GATEHOUSE);

    const checkedOut = await gatehouse.checkOutKey(condoOperatorA, { keyRecordId: key.id, checkedOutTo: 'João Prestador' });
    expect(checkedOut.status).toBe(KeyRecordStatus.CHECKED_OUT);

    await expect(
      gatehouse.checkOutKey(condoOperatorA, { keyRecordId: key.id, checkedOutTo: 'Outra pessoa' }),
    ).rejects.toThrow();

    const returned = await gatehouse.returnKey(condoOperatorA, key.id);
    expect(returned.status).toBe(KeyRecordStatus.WITH_GATEHOUSE);
  });

  it("blocks a condo-scoped operator from touching another condominium's unit", async () => {
    await expect(
      gatehouse.createDelivery(condoOperatorA, { unitId: unitA.id, description: 'x' }).then(async ({ delivery }) => {
        // sanity: this one must succeed since unitA belongs to condoA
        expect(delivery.condominiumId).toBe(condoA.id);
      }),
    ).resolves.toBeUndefined();

    const foreignUnit = await prisma.unit.create({
      data: { condominiumId: condoB.id, resaleId: resale.id, clientId: client.id, identifier: '1' },
    });
    await expect(gatehouse.createDelivery(condoOperatorA, { unitId: foreignUnit.id, description: 'x' })).rejects.toThrow();
    await prisma.unit.delete({ where: { id: foreignUnit.id } });
  });

  it('reports an occurrence and denies a role without SECURITY_OPERATE from doing so', async () => {
    const occurrence = await security.reportOccurrence(condoManagerA, {
      condominiumId: condoA.id,
      title: 'Vazamento',
      description: 'Vazamento na garagem',
      reportedBy: 'Síndico',
    });
    expect(occurrence.condominiumId).toBe(condoA.id);

    const reportOnlyActor: Actor = {
      id: 'actor-client-operator-gh',
      role: UserRole.CLIENT_OPERATOR,
      resaleId: resale.id,
      clientId: client.id,
      condominiumId: null,
      mustChangePassword: false,
    };
    await expect(
      security.reportOccurrence(reportOnlyActor, {
        condominiumId: condoA.id,
        title: 'x',
        description: 'x',
        reportedBy: 'x',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('lets a gatehouse operator trigger a panic alert', async () => {
    const alert = await security.triggerPanicAlert(condoOperatorA, {
      condominiumId: condoA.id,
      unitId: unitA.id,
      triggeredBy: 'Porteiro',
    });
    expect(alert.condominiumId).toBe(condoA.id);
  });

  it('adds a block list entry and enforces per-condominium document uniqueness', async () => {
    await security.addBlockListEntry(condoManagerA, {
      condominiumId: condoA.id,
      document: '111.222.333-44',
      reason: 'Tentativa de acesso indevido',
    });
    await expect(
      security.addBlockListEntry(condoManagerA, {
        condominiumId: condoA.id,
        document: '111.222.333-44',
        reason: 'Duplicata',
      }),
    ).rejects.toThrow();
  });
});
