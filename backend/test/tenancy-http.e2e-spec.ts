import cookieParser from 'cookie-parser';
import request from 'supertest';
import { Test, type TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PasswordHasherService } from '../src/auth/password-hasher.service';

describe('Tenancy (resales/clients/condominiums) HTTP (integration)', () => {
  let moduleRef: TestingModule;
  let app: INestApplication;
  let prisma: PrismaService;
  let hasher: PasswordHasherService;

  const superAdminEmail = 'super-admin-tenancy-it@example.com';
  const superAdminPassword = 'a-strong-password-super-123';
  let superAdminToken: string;

  const cleanupEmails: string[] = [superAdminEmail];
  const cleanupResaleIds: string[] = [];

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1', { exclude: ['health/live', 'health/ready'] });
    await app.init();

    prisma = moduleRef.get(PrismaService);
    hasher = moduleRef.get(PasswordHasherService);

    await prisma.user.create({
      data: {
        email: superAdminEmail,
        passwordHash: await hasher.hash(superAdminPassword),
        role: UserRole.SUPER_ADMIN,
        mustChangePassword: false,
      },
    });
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: superAdminEmail, password: superAdminPassword });
    superAdminToken = login.body.accessToken;
  });

  afterAll(async () => {
    await prisma.idempotencyKey.deleteMany({});
    await prisma.auditLog.deleteMany({ where: { tenantResaleId: { in: cleanupResaleIds } } });
    // Users reference client/condominium/resale via FK — must go first.
    await prisma.refreshToken.deleteMany({ where: { user: { email: { in: cleanupEmails } } } });
    await prisma.user.deleteMany({ where: { email: { in: cleanupEmails } } });
    await prisma.condominium.deleteMany({ where: { client: { resaleId: { in: cleanupResaleIds } } } });
    await prisma.client.deleteMany({ where: { resaleId: { in: cleanupResaleIds } } });
    await prisma.resale.deleteMany({ where: { id: { in: cleanupResaleIds } } });
    await app.close();
    await moduleRef.close();
  });

  const server = () => app.getHttpServer();
  const superAdminAuth = () => ({ Authorization: `Bearer ${superAdminToken}` });

  it('lets a super admin create and list a resale', async () => {
    const created = await request(server())
      .post('/api/v1/platform/resales')
      .set(superAdminAuth())
      .set('Idempotency-Key', 'resale-key-1')
      .send({ name: 'Revenda Teste HTTP', slug: 'revenda-teste-http-it' });
    expect(created.status).toBe(201);
    cleanupResaleIds.push(created.body.id);

    const list = await request(server())
      .get('/api/v1/platform/resales')
      .query({ page: 1, pageSize: 50 })
      .set(superAdminAuth());
    expect(list.status).toBe(200);
    expect(list.body.items.some((r: { id: string }) => r.id === created.body.id)).toBe(true);
  });

  it('denies a resale admin from creating a resale', async () => {
    const resale = await prisma.resale.create({ data: { name: 'Revenda B HTTP', slug: 'revenda-b-http-it' } });
    cleanupResaleIds.push(resale.id);

    const resaleAdminEmail = 'resale-admin-tenancy-it@example.com';
    cleanupEmails.push(resaleAdminEmail);
    await prisma.user.create({
      data: {
        email: resaleAdminEmail,
        passwordHash: await hasher.hash('a-strong-password-ra-123'),
        role: UserRole.RESALE_ADMIN,
        resaleId: resale.id,
        mustChangePassword: false,
      },
    });
    const login = await request(server())
      .post('/api/v1/auth/login')
      .send({ email: resaleAdminEmail, password: 'a-strong-password-ra-123' });

    const res = await request(server())
      .post('/api/v1/platform/resales')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .set('Idempotency-Key', 'resale-denied-1')
      .send({ name: 'x', slug: 'x-x' });
    expect(res.status).toBe(403);
  });

  it('forces a resale-scoped actor to create clients only under their own resale, ignoring a spoofed resaleId', async () => {
    const resaleA = await prisma.resale.create({ data: { name: 'Revenda A HTTP', slug: 'revenda-a-http-it' } });
    const resaleB = await prisma.resale.create({ data: { name: 'Revenda C HTTP', slug: 'revenda-c-http-it' } });
    cleanupResaleIds.push(resaleA.id, resaleB.id);

    const resaleAdminEmail = 'resale-admin-a-tenancy-it@example.com';
    cleanupEmails.push(resaleAdminEmail);
    await prisma.user.create({
      data: {
        email: resaleAdminEmail,
        passwordHash: await hasher.hash('a-strong-password-raa-123'),
        role: UserRole.RESALE_ADMIN,
        resaleId: resaleA.id,
        mustChangePassword: false,
      },
    });
    const login = await request(server())
      .post('/api/v1/auth/login')
      .send({ email: resaleAdminEmail, password: 'a-strong-password-raa-123' });

    // Body claims resaleB, but the actor belongs to resaleA — the spoofed
    // id must be ignored, not honored and not silently blocked with a
    // generic error.
    const created = await request(server())
      .post('/api/v1/platform/clients')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .set('Idempotency-Key', 'client-spoof-1')
      .send({ resaleId: resaleB.id, name: 'Cliente Spoof', slug: 'cliente-spoof-it' });
    expect(created.status).toBe(201);
    expect(created.body.resaleId).toBe(resaleA.id);

    const listB = await request(server())
      .get('/api/v1/platform/clients')
      .query({ resaleId: resaleB.id, page: 1, pageSize: 20 })
      .set('Authorization', `Bearer ${login.body.accessToken}`);
    expect(listB.status).toBe(200);
    expect(listB.body.items).toHaveLength(0);
  });

  it('lets a client admin create a condominium under their own client, ignoring a spoofed clientId', async () => {
    const resale = await prisma.resale.create({ data: { name: 'Revenda D HTTP', slug: 'revenda-d-http-it' } });
    const clientA = await prisma.client.create({
      data: { resaleId: resale.id, name: 'Cliente A HTTP', slug: 'cliente-a-http-it' },
    });
    const clientB = await prisma.client.create({
      data: { resaleId: resale.id, name: 'Cliente B HTTP', slug: 'cliente-b-http-it' },
    });
    cleanupResaleIds.push(resale.id);

    const clientAdminEmail = 'client-admin-tenancy-it@example.com';
    cleanupEmails.push(clientAdminEmail);
    await prisma.user.create({
      data: {
        email: clientAdminEmail,
        passwordHash: await hasher.hash('a-strong-password-ca-123'),
        role: UserRole.CLIENT_ADMIN,
        resaleId: resale.id,
        clientId: clientA.id,
        mustChangePassword: false,
      },
    });
    const login = await request(server())
      .post('/api/v1/auth/login')
      .send({ email: clientAdminEmail, password: 'a-strong-password-ca-123' });

    const created = await request(server())
      .post('/api/v1/platform/condominiums')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .set('Idempotency-Key', 'condo-spoof-1')
      .send({ clientId: clientB.id, name: 'Condo Spoof', slug: 'condo-spoof-it' });
    expect(created.status).toBe(201);
    expect(created.body.clientId).toBe(clientA.id);
  });
});
