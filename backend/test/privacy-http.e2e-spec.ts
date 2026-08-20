import cookieParser from 'cookie-parser';
import request from 'supertest';
import { Test, type TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PasswordHasherService } from '../src/auth/password-hasher.service';

describe('Privacy/LGPD HTTP (integration)', () => {
  let moduleRef: TestingModule;
  let app: INestApplication;
  let prisma: PrismaService;

  let resale: { id: string };
  let client: { id: string };
  let condominium: { id: string };

  const clientAdminEmail = 'client-admin-privacy-it@example.com';
  const clientAdminPassword = 'a-strong-password-privacy-123';
  let accessToken: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1', { exclude: ['health/live', 'health/ready'] });
    await app.init();

    prisma = moduleRef.get(PrismaService);
    const hasher = moduleRef.get(PasswordHasherService);

    resale = await prisma.resale.create({ data: { name: 'Revenda Privacy', slug: 'revenda-privacy-it' } });
    client = await prisma.client.create({
      data: { resaleId: resale.id, name: 'Cliente Privacy', slug: 'cliente-privacy-it' },
    });
    condominium = await prisma.condominium.create({
      data: { resaleId: resale.id, clientId: client.id, name: 'Condo Privacy', slug: 'condo-privacy-it' },
    });

    await prisma.user.create({
      data: {
        email: clientAdminEmail,
        passwordHash: await hasher.hash(clientAdminPassword),
        role: UserRole.CLIENT_ADMIN,
        resaleId: resale.id,
        clientId: client.id,
        mustChangePassword: false,
      },
    });
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: clientAdminEmail, password: clientAdminPassword });
    accessToken = login.body.accessToken;
  });

  afterAll(async () => {
    await prisma.idempotencyKey.deleteMany({});
    await prisma.auditLog.deleteMany({ where: { tenantClientId: client.id } });
    await prisma.legalHold.deleteMany({ where: { clientId: client.id } });
    await prisma.dataSubjectRequest.deleteMany({ where: { clientId: client.id } });
    await prisma.consent.deleteMany({ where: { clientId: client.id } });
    await prisma.blockListEntry.deleteMany({ where: { clientId: client.id } });
    await prisma.refreshToken.deleteMany({ where: { user: { email: clientAdminEmail } } });
    await prisma.user.deleteMany({ where: { email: clientAdminEmail } });
    await prisma.condominium.deleteMany({ where: { id: condominium.id } });
    await prisma.client.deleteMany({ where: { id: client.id } });
    await prisma.resale.deleteMany({ where: { id: resale.id } });
    await app.close();
    await moduleRef.close();
  });

  const server = () => app.getHttpServer();
  const auth = () => ({ Authorization: `Bearer ${accessToken}` });

  it('records a consent and lists it back', async () => {
    const created = await request(server())
      .post('/api/v1/privacy/consents')
      .set(auth())
      .set('Idempotency-Key', 'consent-key-1')
      .send({
        condominiumId: condominium.id,
        subjectName: 'Morador Exemplo',
        subjectDocument: '11122233344',
        purpose: 'call_recording',
        granted: true,
      });
    expect(created.status).toBe(201);
    expect(created.body.granted).toBe(true);
    expect(created.body.grantedAt).not.toBeNull();

    const list = await request(server())
      .get('/api/v1/privacy/consents')
      .query({ condominiumId: condominium.id, page: 1, pageSize: 10 })
      .set(auth());
    expect(list.status).toBe(200);
    expect(list.body.items.some((c: { id: string }) => c.id === created.body.id)).toBe(true);
  });

  it('creates a DELETION request, blocks approval while a legal hold is active, then allows it after the hold is lifted', async () => {
    const document = '99988877766';

    const hold = await request(server())
      .post('/api/v1/privacy/legal-holds')
      .set(auth())
      .set('Idempotency-Key', 'hold-key-1')
      .send({ condominiumId: condominium.id, subjectDocument: document, reason: 'Processo judicial em andamento' });
    expect(hold.status).toBe(201);

    const deletionRequest = await request(server())
      .post('/api/v1/privacy/requests')
      .set(auth())
      .set('Idempotency-Key', 'request-key-1')
      .send({
        condominiumId: condominium.id,
        requesterName: 'Titular Exemplo',
        requesterDocument: document,
        type: 'DELETION',
      });
    expect(deletionRequest.status).toBe(201);

    const blockedResolve = await request(server())
      .post(`/api/v1/privacy/requests/${deletionRequest.body.id}/resolve`)
      .set(auth())
      .set('Idempotency-Key', 'resolve-key-1')
      .send({ approve: true });
    expect(blockedResolve.status).toBe(409);

    const liftHold = await request(server())
      .post(`/api/v1/privacy/legal-holds/${hold.body.id}/lift`)
      .set(auth())
      .set('Idempotency-Key', 'lift-key-1')
      .send();
    expect(liftHold.status).toBe(201);
    expect(liftHold.body.liftedAt).not.toBeNull();

    const approvedResolve = await request(server())
      .post(`/api/v1/privacy/requests/${deletionRequest.body.id}/resolve`)
      .set(auth())
      .set('Idempotency-Key', 'resolve-key-2')
      .send({ approve: true, resolutionNotes: 'Confirmado, hold levantado.' });
    expect(approvedResolve.status).toBe(201);
    expect(approvedResolve.body.status).toBe('COMPLETED');
  });

  it('exports matching block-list data for an ACCESS request, noting the Resident limitation', async () => {
    const document = '55566677788';
    // Created directly via Prisma, not the /security/block-list endpoint:
    // CLIENT_ADMIN (this test's actor) deliberately lacks SECURITY_OPERATE
    // (only condo-level roles operate security day to day) — this test is
    // about export, not about who can create a block-list entry.
    await prisma.blockListEntry.create({
      data: { resaleId: resale.id, clientId: client.id, condominiumId: condominium.id, document, reason: 'teste export' },
    });

    const accessRequest = await request(server())
      .post('/api/v1/privacy/requests')
      .set(auth())
      .set('Idempotency-Key', 'request-key-2')
      .send({ condominiumId: condominium.id, requesterName: 'Titular Access', requesterDocument: document, type: 'ACCESS' });
    expect(accessRequest.status).toBe(201);

    const exported = await request(server())
      .get(`/api/v1/privacy/requests/${accessRequest.body.id}/export`)
      .set(auth());
    expect(exported.status).toBe(200);
    expect(exported.body.blockListEntries).toHaveLength(1);
    expect(exported.body.note).toMatch(/Resident/i);
  });

  it('rejects export for a CORRECTION request (only ACCESS/PORTABILITY apply)', async () => {
    const correctionRequest = await request(server())
      .post('/api/v1/privacy/requests')
      .set(auth())
      .set('Idempotency-Key', 'request-key-3')
      .send({
        condominiumId: condominium.id,
        requesterName: 'Titular Correction',
        requesterDocument: '11111111111',
        type: 'CORRECTION',
      });
    expect(correctionRequest.status).toBe(201);

    const exported = await request(server()).get(`/api/v1/privacy/requests/${correctionRequest.body.id}/export`).set(auth());
    expect(exported.status).toBe(400);
  });

  it('denies a role without PRIVACY_MANAGE from creating a request', async () => {
    const hasher = moduleRef.get(PasswordHasherService);
    const operatorEmail = 'client-operator-privacy-it@example.com';
    await prisma.user.create({
      data: {
        email: operatorEmail,
        passwordHash: await hasher.hash('a-strong-password-op-priv-123'),
        role: UserRole.CLIENT_OPERATOR,
        resaleId: resale.id,
        clientId: client.id,
        mustChangePassword: false,
      },
    });
    const login = await request(server())
      .post('/api/v1/auth/login')
      .send({ email: operatorEmail, password: 'a-strong-password-op-priv-123' });

    const res = await request(server())
      .post('/api/v1/privacy/requests')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .set('Idempotency-Key', 'request-denied-1')
      .send({ condominiumId: condominium.id, requesterName: 'x', requesterDocument: '00000000000', type: 'ACCESS' });
    expect(res.status).toBe(403);

    await prisma.refreshToken.deleteMany({ where: { user: { email: operatorEmail } } });
    await prisma.user.deleteMany({ where: { email: operatorEmail } });
  });
});
