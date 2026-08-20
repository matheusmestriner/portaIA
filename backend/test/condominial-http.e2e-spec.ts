import cookieParser from 'cookie-parser';
import request from 'supertest';
import { Test, type TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PasswordHasherService } from '../src/auth/password-hasher.service';

describe('Condominial (residents/vehicles/providers) HTTP (integration)', () => {
  let moduleRef: TestingModule;
  let app: INestApplication;
  let prisma: PrismaService;

  let resale: { id: string };
  let client: { id: string };
  let condominium: { id: string };
  let unit: { id: string };

  const clientAdminEmail = 'client-admin-cond-http-it@example.com';
  const clientAdminPassword = 'a-strong-password-cond-http-123';
  let accessToken: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1', { exclude: ['health/live', 'health/ready'] });
    await app.init();

    prisma = moduleRef.get(PrismaService);
    const hasher = moduleRef.get(PasswordHasherService);

    resale = await prisma.resale.create({ data: { name: 'Revenda Cond HTTP', slug: 'revenda-cond-http-it' } });
    client = await prisma.client.create({
      data: { name: 'Cliente Cond HTTP', slug: 'cliente-cond-http-it', resaleId: resale.id },
    });
    condominium = await prisma.condominium.create({
      data: { name: 'Condo Cond HTTP', slug: 'condo-cond-http-it', clientId: client.id, resaleId: resale.id },
    });
    unit = await prisma.unit.create({
      data: { condominiumId: condominium.id, resaleId: resale.id, clientId: client.id, identifier: 'H-101' },
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
    await prisma.vehicle.deleteMany({ where: { condominiumId: condominium.id } });
    await prisma.resident.deleteMany({ where: { condominiumId: condominium.id } });
    await prisma.provider.deleteMany({ where: { condominiumId: condominium.id } });
    await prisma.refreshToken.deleteMany({ where: { user: { email: clientAdminEmail } } });
    await prisma.user.deleteMany({ where: { email: clientAdminEmail } });
    await prisma.unit.deleteMany({ where: { id: unit.id } });
    await prisma.condominium.deleteMany({ where: { id: condominium.id } });
    await prisma.client.deleteMany({ where: { id: client.id } });
    await prisma.resale.deleteMany({ where: { id: resale.id } });
    await app.close();
    await moduleRef.close();
  });

  const server = () => app.getHttpServer();
  const auth = () => ({ Authorization: `Bearer ${accessToken}` });

  it('creates and lists a resident', async () => {
    const created = await request(server())
      .post('/api/v1/condominial/residents')
      .set(auth())
      .set('Idempotency-Key', 'resident-key-1')
      .send({ unitId: unit.id, name: 'Ana Moradora', isPrimary: true });
    expect(created.status).toBe(201);
    expect(created.body.name).toBe('Ana Moradora');

    const list = await request(server())
      .get('/api/v1/condominial/residents')
      .query({ unitId: unit.id, page: 1, pageSize: 10 })
      .set(auth());
    expect(list.status).toBe(200);
    expect(list.body.items.some((r: { id: string }) => r.id === created.body.id)).toBe(true);
  });

  it('creates and lists a vehicle, rejecting a duplicate plate in the same condominium', async () => {
    const created = await request(server())
      .post('/api/v1/condominial/vehicles')
      .set(auth())
      .set('Idempotency-Key', 'vehicle-key-1')
      .send({ unitId: unit.id, plate: 'hxy1234' });
    expect(created.status).toBe(201);
    expect(created.body.plate).toBe('HXY1234');

    const duplicate = await request(server())
      .post('/api/v1/condominial/vehicles')
      .set(auth())
      .set('Idempotency-Key', 'vehicle-key-2')
      .send({ unitId: unit.id, plate: 'hxy1234' });
    expect(duplicate.status).toBe(409);

    const list = await request(server())
      .get('/api/v1/condominial/vehicles')
      .query({ condominiumId: condominium.id, page: 1, pageSize: 10 })
      .set(auth());
    expect(list.status).toBe(200);
    expect(list.body.items).toHaveLength(1);
  });

  it('creates and lists a provider', async () => {
    const created = await request(server())
      .post('/api/v1/condominial/providers')
      .set(auth())
      .set('Idempotency-Key', 'provider-key-1')
      .send({ condominiumId: condominium.id, name: 'Dedetizadora HTTP', document: '12345678000199' });
    expect(created.status).toBe(201);

    const list = await request(server())
      .get('/api/v1/condominial/providers')
      .query({ condominiumId: condominium.id, page: 1, pageSize: 10 })
      .set(auth());
    expect(list.status).toBe(200);
    expect(list.body.items.some((p: { id: string }) => p.id === created.body.id)).toBe(true);
  });

  it('denies a role without CONDOMINIUM_MANAGE from creating a resident', async () => {
    const hasher = moduleRef.get(PasswordHasherService);
    const reportOnlyEmail = 'client-operator-cond-http-it@example.com';
    await prisma.user.create({
      data: {
        email: reportOnlyEmail,
        passwordHash: await hasher.hash('a-strong-password-ro-cond-123'),
        role: UserRole.CLIENT_OPERATOR,
        resaleId: resale.id,
        clientId: client.id,
        mustChangePassword: false,
      },
    });
    const login = await request(server())
      .post('/api/v1/auth/login')
      .send({ email: reportOnlyEmail, password: 'a-strong-password-ro-cond-123' });

    const res = await request(server())
      .post('/api/v1/condominial/residents')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .set('Idempotency-Key', 'resident-denied-1')
      .send({ unitId: unit.id, name: 'x', isPrimary: true });
    expect(res.status).toBe(403);

    await prisma.user.deleteMany({ where: { email: reportOnlyEmail } });
  });
});
