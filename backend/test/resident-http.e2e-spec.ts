import request from 'supertest';
import { Test, type TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PasswordHasherService } from '../src/auth/password-hasher.service';
import { encryptSipPassword } from '../src/telephony/sip-credential.crypto';

/**
 * Isolamento por unidade para as rotas de morador: a RLS só vai até
 * condominiumId (não existe app.tenant_unit_id) — o filtro por unitId é
 * responsabilidade do código (ResidentService, ver o comentário lá). Este
 * teste prova que um morador da unidade A nunca enxerga nem consegue agir
 * sobre dados da unidade B, mesmo estando no mesmo condomínio.
 */
describe('Resident-scoped HTTP routes (integration)', () => {
  let moduleRef: TestingModule;
  let app: INestApplication;
  let prisma: PrismaService;
  let hasher: PasswordHasherService;

  let resale: { id: string };
  let client: { id: string };
  let condominium: { id: string };
  let unitA: { id: string };
  let unitB: { id: string };

  const emailA = 'resident-http-it-a@example.com';
  const emailB = 'resident-http-it-b@example.com';
  const password = 'a-strong-password-resident-scope-1';

  let accessTokenA: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1', { exclude: ['health/live', 'health/ready'] });
    await app.init();

    prisma = moduleRef.get(PrismaService);
    hasher = moduleRef.get(PasswordHasherService);

    resale = await prisma.resale.create({ data: { name: 'Revenda Resident Scope', slug: 'revenda-resident-scope-it' } });
    client = await prisma.client.create({ data: { name: 'Cliente Resident Scope', slug: 'cliente-resident-scope-it', resaleId: resale.id } });
    condominium = await prisma.condominium.create({
      data: { name: 'Condo Resident Scope', slug: 'condo-resident-scope-it', clientId: client.id, resaleId: resale.id },
    });
    unitA = await prisma.unit.create({ data: { condominiumId: condominium.id, resaleId: resale.id, clientId: client.id, identifier: 'A-101' } });
    unitB = await prisma.unit.create({ data: { condominiumId: condominium.id, resaleId: resale.id, clientId: client.id, identifier: 'B-202' } });

    await prisma.resident.create({
      data: {
        unitId: unitA.id,
        resaleId: resale.id,
        clientId: client.id,
        condominiumId: condominium.id,
        name: 'Ana da Unidade A',
        email: emailA,
        passwordHash: await hasher.hash(password),
        mustChangePassword: false,
      },
    });
    await prisma.resident.create({
      data: {
        unitId: unitB.id,
        resaleId: resale.id,
        clientId: client.id,
        condominiumId: condominium.id,
        name: 'Bruno da Unidade B',
        email: emailB,
        passwordHash: await hasher.hash(password),
        mustChangePassword: false,
      },
    });

    // Unidade B tem mais movimento que A, de propósito — se o dashboard de A
    // vazasse dados de B, os números bateriam com B, não com A.
    await prisma.delivery.create({
      data: { unitId: unitA.id, resaleId: resale.id, clientId: client.id, condominiumId: condominium.id, description: 'Encomenda A' },
    });
    await prisma.delivery.create({
      data: { unitId: unitB.id, resaleId: resale.id, clientId: client.id, condominiumId: condominium.id, description: 'Encomenda B 1' },
    });
    await prisma.delivery.create({
      data: { unitId: unitB.id, resaleId: resale.id, clientId: client.id, condominiumId: condominium.id, description: 'Encomenda B 2' },
    });
    await prisma.visitor.create({
      data: { unitId: unitB.id, resaleId: resale.id, clientId: client.id, condominiumId: condominium.id, name: 'Visitante de B' },
    });

    await prisma.announcement.create({
      data: { condominiumId: condominium.id, resaleId: resale.id, clientId: client.id, title: 'Aviso geral', body: 'Corpo do aviso', createdBy: 'seed' },
    });

    const loginRes = await request(app.getHttpServer()).post('/api/v1/resident-auth/login').send({ email: emailA, password });
    accessTokenA = loginRes.body.accessToken;
  });

  afterAll(async () => {
    await prisma.residentRefreshToken.deleteMany({ where: { resident: { condominiumId: condominium.id } } });
    await prisma.resident.deleteMany({ where: { condominiumId: condominium.id } });
    await prisma.delivery.deleteMany({ where: { condominiumId: condominium.id } });
    await prisma.visitor.deleteMany({ where: { condominiumId: condominium.id } });
    await prisma.announcement.deleteMany({ where: { condominiumId: condominium.id } });
    await prisma.extension.deleteMany({ where: { condominiumId: condominium.id } });
    await prisma.unit.deleteMany({ where: { id: { in: [unitA.id, unitB.id] } } });
    await prisma.condominium.deleteMany({ where: { id: condominium.id } });
    await prisma.client.deleteMany({ where: { id: client.id } });
    await prisma.resale.deleteMany({ where: { id: resale.id } });
    await app.close();
    await moduleRef.close();
  });

  const server = () => app.getHttpServer();
  const auth = () => ({ Authorization: `Bearer ${accessTokenA}` });

  it('GET /resident/me returns only the caller\'s own unit and condominium', async () => {
    const res = await request(server()).get('/api/v1/resident/me').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.unit.id).toBe(unitA.id);
    expect(res.body.unit.identifier).toBe('A-101');
    expect(res.body.condominium.id).toBe(condominium.id);
  });

  it('GET /resident/dashboard counts only the caller\'s own unit, not the whole condominium', async () => {
    const res = await request(server()).get('/api/v1/resident/dashboard').set(auth());
    expect(res.status).toBe(200);
    // Unit A has exactly 1 pending delivery and 0 visitors — if this leaked
    // unit B's data it would show 3 deliveries and 1+ visitors instead.
    expect(res.body.pendingDeliveries).toBe(1);
    expect(res.body.visitorsThisMonth).toBe(0);
    expect(res.body.avgVisitDurationMinutes).toBeNull();
  });

  it('GET /resident/deliveries lists only the caller\'s own unit\'s deliveries', async () => {
    const res = await request(server()).get('/api/v1/resident/deliveries').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].description).toBe('Encomenda A');
    expect(res.body.items[0].unitId).toBe(unitA.id);
  });

  it('reissues a credential for the caller\'s own delivery', async () => {
    const list = await request(server()).get('/api/v1/resident/deliveries').set(auth());
    const deliveryId = list.body.items[0].id;

    const res = await request(server())
      .post(`/api/v1/resident/deliveries/${deliveryId}/credential`)
      .set(auth())
      .set('Idempotency-Key', 'resident-http-it-reissue-1')
      .send({});
    expect(res.status).toBe(201);
    expect(res.body.pickupCode).toMatch(/^\d{6}$/);
    expect(res.body.qrPayload).toContain(deliveryId);
  });

  it('refuses to reissue a credential for a delivery belonging to another unit', async () => {
    const otherDelivery = await prisma.delivery.findFirstOrThrow({ where: { unitId: unitB.id } });

    const res = await request(server())
      .post(`/api/v1/resident/deliveries/${otherDelivery.id}/credential`)
      .set(auth())
      .set('Idempotency-Key', 'resident-http-it-reissue-cross-unit-1')
      .send({});
    expect(res.status).toBe(403);
  });

  it('GET /resident/announcements returns the condominium\'s announcements', async () => {
    const res = await request(server()).get('/api/v1/resident/announcements').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].title).toBe('Aviso geral');
  });

  it('GET /resident/telephony/credentials reports not configured when the unit has no extension', async () => {
    const res = await request(server()).get('/api/v1/resident/telephony/credentials').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.configured).toBe(false);
    expect(res.body.sipUsername).toBeNull();
  });

  it('GET /resident/telephony/credentials decrypts the unit\'s own SIP password once an extension exists, but stays unconfigured without SIP_DOMAIN', async () => {
    const sipSecretKey = process.env.TELEPHONY_SIP_SECRET_KEY as string;
    const plainPassword = 'plain-sip-password-for-unit-a';
    await prisma.extension.create({
      data: {
        unitId: unitA.id,
        resaleId: resale.id,
        clientId: client.id,
        condominiumId: condominium.id,
        number: '101',
        sipUsername: '101',
        sipPasswordEncrypted: encryptSipPassword(plainPassword, sipSecretKey),
      },
    });

    const res = await request(server()).get('/api/v1/resident/telephony/credentials').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.sipUsername).toBe('101');
    expect(res.body.sipPassword).toBe(plainPassword);
    // Nenhum SIP_DOMAIN configurado no ambiente de teste — honesto: mesmo
    // com a extensão pronta, o app não deve achar que pode registrar de verdade.
    expect(res.body.configured).toBe(process.env.SIP_DOMAIN ? true : false);
  });
});
