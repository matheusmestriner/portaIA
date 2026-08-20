import cookieParser from 'cookie-parser';
import request from 'supertest';
import { Test, type TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PasswordHasherService } from '../src/auth/password-hasher.service';

/**
 * Exercises the real HTTP surface (guards, cookies, CSRF, rate limit,
 * idempotency, standardized error envelope) with supertest against a live
 * Postgres instance. Complements the use-case-level integration tests,
 * which never go through Express/Nest's HTTP pipeline.
 */
describe('API HTTP (integration)', () => {
  let moduleRef: TestingModule;
  let app: INestApplication;
  let prisma: PrismaService;

  let resale: { id: string };
  let client: { id: string };
  let condominium: { id: string };
  let clientAdminEmail: string;
  const clientAdminPassword = 'a-strong-password-http-123';

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1', { exclude: ['health/live', 'health/ready'] });
    await app.init();

    prisma = moduleRef.get(PrismaService);
    const hasher = moduleRef.get(PasswordHasherService);

    resale = await prisma.resale.create({ data: { name: 'Revenda HTTP', slug: 'revenda-http-it' } });
    client = await prisma.client.create({ data: { name: 'Cliente HTTP', slug: 'cliente-http-it', resaleId: resale.id } });
    condominium = await prisma.condominium.create({
      data: { name: 'Condo HTTP', slug: 'condo-http-it', clientId: client.id, resaleId: resale.id },
    });

    clientAdminEmail = 'client-admin-http-it@example.com';
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
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { tenantClientId: client.id } });
    await prisma.idempotencyKey.deleteMany({});
    await prisma.unit.deleteMany({ where: { condominiumId: condominium.id } });
    await prisma.refreshToken.deleteMany({ where: { user: { email: clientAdminEmail } } });
    await prisma.user.deleteMany({ where: { email: clientAdminEmail } });
    await prisma.condominium.deleteMany({ where: { id: condominium.id } });
    await prisma.client.deleteMany({ where: { id: client.id } });
    await prisma.resale.deleteMany({ where: { id: resale.id } });
    await app.close();
    await moduleRef.close();
  });

  const server = () => app.getHttpServer();

  it('rejects a protected route with no access token, in the standardized error envelope', async () => {
    const res = await request(server()).get('/api/v1/condominial/units').query({ condominiumId: condominium.id });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatchObject({ code: expect.any(String), message: expect.any(String) });
    expect(res.body.error.correlationId).toBeDefined();
  });

  it('logs in, sets an HttpOnly refresh cookie and a readable CSRF cookie, and returns an access token', async () => {
    const res = await request(server()).post('/api/v1/auth/login').send({
      email: clientAdminEmail,
      password: clientAdminPassword,
    });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.csrfToken).toEqual(expect.any(String));

    const cookies = res.headers['set-cookie'] as unknown as string[];
    const refreshCookie = cookies.find((c) => c.startsWith('portalia_refresh='));
    const csrfCookie = cookies.find((c) => c.startsWith('portalia_csrf='));
    expect(refreshCookie).toMatch(/HttpOnly/);
    expect(csrfCookie).not.toMatch(/HttpOnly/);
  });

  it('rejects the wrong password with a 401', async () => {
    const res = await request(server()).post('/api/v1/auth/login').send({ email: clientAdminEmail, password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('rejects a refresh attempt with a missing/mismatched CSRF token', async () => {
    const login = await request(server()).post('/api/v1/auth/login').send({
      email: clientAdminEmail,
      password: clientAdminPassword,
    });
    const cookies = (login.headers['set-cookie'] as unknown as string[]).join('; ');

    const res = await request(server()).post('/api/v1/auth/refresh').set('Cookie', cookies);
    expect(res.status).toBe(403);
  });

  it('creates a unit, requires Idempotency-Key, and replays the same response on retry', async () => {
    const login = await request(server()).post('/api/v1/auth/login').send({
      email: clientAdminEmail,
      password: clientAdminPassword,
    });
    const accessToken = login.body.accessToken;

    const missingKeyRes = await request(server())
      .post('/api/v1/condominial/units')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ condominiumId: condominium.id, identifier: 'HTTP-101' });
    expect(missingKeyRes.status).toBe(400);

    const first = await request(server())
      .post('/api/v1/condominial/units')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Idempotency-Key', 'test-key-1')
      .send({ condominiumId: condominium.id, identifier: 'HTTP-101' });
    expect(first.status).toBe(201);
    expect(first.body.identifier).toBe('HTTP-101');

    const second = await request(server())
      .post('/api/v1/condominial/units')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Idempotency-Key', 'test-key-1')
      .send({ condominiumId: condominium.id, identifier: 'HTTP-101' });
    expect(second.body).toEqual(first.body);

    const count = await prisma.unit.count({ where: { condominiumId: condominium.id, identifier: 'HTTP-101' } });
    expect(count).toBe(1);
  });

  it('lists units with pagination envelope', async () => {
    const login = await request(server()).post('/api/v1/auth/login').send({
      email: clientAdminEmail,
      password: clientAdminPassword,
    });
    const accessToken = login.body.accessToken;

    const res = await request(server())
      .get('/api/v1/condominial/units')
      .query({ condominiumId: condominium.id, page: 1, pageSize: 10 })
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 1, pageSize: 10 });
    expect(Array.isArray(res.body.items)).toBe(true);

    // Express's default query parser (qs) turns bracket notation into a
    // nested object — condominiumId would arrive as {not: '...'} instead of
    // a string, which a typed Prisma `where: { condominiumId }` accepts as
    // a StringFilter operator if nothing validates the shape first. Reuses
    // this test's own login instead of spending another out of the file's
    // shared 5/min budget.
    const smuggled = await request(server())
      .get('/api/v1/condominial/units')
      .query({ 'condominiumId[not]': '00000000-0000-0000-0000-000000000000', page: 1, pageSize: 10 })
      .set('Authorization', `Bearer ${accessToken}`);
    expect(smuggled.status).toBe(400);
  });

  it('rate limits repeated login attempts', async () => {
    const attempts = await Promise.all(
      Array.from({ length: 8 }, () =>
        request(server()).post('/api/v1/auth/login').send({ email: clientAdminEmail, password: 'wrong' }),
      ),
    );
    expect(attempts.some((r) => r.status === 429)).toBe(true);
  });
});
