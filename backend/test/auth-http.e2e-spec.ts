import cookieParser from 'cookie-parser';
import request from 'supertest';
import { Test, type TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PasswordHasherService } from '../src/auth/password-hasher.service';

/**
 * Covers the auth-hardening changes from the security pass: logout revoking
 * every active session (not just the presented token), mustChangePassword
 * surviving a refresh, and the MustChangePasswordGuard actually blocking the
 * API server-side (not just a client-side gate that a raw API call bypasses).
 */
describe('Auth HTTP hardening (integration)', () => {
  let moduleRef: TestingModule;
  let app: INestApplication;
  let prisma: PrismaService;
  let hasher: PasswordHasherService;

  let resale: { id: string };
  let client: { id: string };
  let condominium: { id: string };

  const activeEmail = 'auth-http-it-active@example.com';
  const activePassword = 'a-strong-password-auth-http-1';

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1', { exclude: ['health/live', 'health/ready'] });
    await app.init();

    prisma = moduleRef.get(PrismaService);
    hasher = moduleRef.get(PasswordHasherService);

    resale = await prisma.resale.create({ data: { name: 'Revenda Auth HTTP', slug: 'revenda-auth-http-it' } });
    client = await prisma.client.create({
      data: { name: 'Cliente Auth HTTP', slug: 'cliente-auth-http-it', resaleId: resale.id },
    });
    condominium = await prisma.condominium.create({
      data: { name: 'Condo Auth HTTP', slug: 'condo-auth-http-it', clientId: client.id, resaleId: resale.id },
    });

    await prisma.user.create({
      data: {
        email: activeEmail,
        passwordHash: await hasher.hash(activePassword),
        role: UserRole.CLIENT_ADMIN,
        resaleId: resale.id,
        clientId: client.id,
        mustChangePassword: false,
      },
    });
  });

  afterAll(async () => {
    await prisma.refreshToken.deleteMany({ where: { user: { email: { endsWith: '@example.com' }, clientId: client.id } } });
    await prisma.user.deleteMany({ where: { clientId: client.id } });
    await prisma.condominium.deleteMany({ where: { id: condominium.id } });
    await prisma.client.deleteMany({ where: { id: client.id } });
    await prisma.resale.deleteMany({ where: { id: resale.id } });
    await app.close();
    await moduleRef.close();
  });

  const server = () => app.getHttpServer();

  async function login(email: string, password: string) {
    const res = await request(server()).post('/api/v1/auth/login').send({ email, password });
    const cookies = (res.headers['set-cookie'] as unknown as string[]).join('; ');
    return { body: res.body as { accessToken: string; csrfToken: string; mustChangePassword: boolean }, cookies };
  }

  it('refresh echoes the current mustChangePassword flag alongside the rotated token', async () => {
    const session = await login(activeEmail, activePassword);

    const res = await request(server())
      .post('/api/v1/auth/refresh')
      .set('Cookie', session.cookies)
      .set('X-CSRF-Token', session.body.csrfToken);

    expect(res.status).toBe(200);
    expect(res.body.mustChangePassword).toBe(false);
    expect(res.body.accessToken).toEqual(expect.any(String));
  });

  it('logout revokes every active refresh token for the user, not just the one presented', async () => {
    const sessionA = await login(activeEmail, activePassword);
    const sessionB = await login(activeEmail, activePassword);

    // Log out using session A's own cookie/access token/CSRF triplet.
    await request(server())
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${sessionA.body.accessToken}`)
      .set('Cookie', sessionA.cookies)
      .set('X-CSRF-Token', sessionA.body.csrfToken)
      .expect(204);

    // Session B never presented its cookie to /auth/logout, yet a concurrent
    // logout must have reached it too — otherwise it survives as an orphaned
    // valid session (the exact bug the security audit flagged).
    const refreshB = await request(server())
      .post('/api/v1/auth/refresh')
      .set('Cookie', sessionB.cookies)
      .set('X-CSRF-Token', sessionB.body.csrfToken);
    expect(refreshB.status).toBe(401);

    const remaining = await prisma.refreshToken.count({
      where: { user: { email: activeEmail }, revokedAt: null },
    });
    expect(remaining).toBe(0);
  });

  it('blocks every route except change-password/logout while mustChangePassword is pending, and unblocks after the change', async () => {
    // Login is rate-limited at 5/min per IP and this whole file shares that
    // budget (an in-memory Nest app per file, not per test) — kept to 2
    // logins here so the suite doesn't trip its own throttle.
    const pendingEmail = 'auth-http-it-pending@example.com';
    const pendingPassword = 'a-strong-password-auth-http-2';
    const newPassword = 'a-new-strong-password-auth-http-3';

    await prisma.user.create({
      data: {
        email: pendingEmail,
        passwordHash: await hasher.hash(pendingPassword),
        role: UserRole.CLIENT_ADMIN,
        resaleId: resale.id,
        clientId: client.id,
        mustChangePassword: true,
      },
    });

    const session = await login(pendingEmail, pendingPassword);
    expect(session.body.mustChangePassword).toBe(true);
    const auth = () => ({ Authorization: `Bearer ${session.body.accessToken}` });

    // An ordinary authorized route must be rejected server-side — the client
    // gate is cosmetic if the API itself still honors this token elsewhere.
    const blocked = await request(server())
      .get('/api/v1/condominial/units')
      .query({ condominiumId: condominium.id, page: 1, pageSize: 10 })
      .set(auth());
    expect(blocked.status).toBe(403);

    // logout must stay reachable even mid-pending, or the user is stuck.
    const logoutAllowed = await request(server())
      .post('/api/v1/auth/logout')
      .set(auth())
      .set('Cookie', session.cookies)
      .set('X-CSRF-Token', session.body.csrfToken);
    expect(logoutAllowed.status).toBe(204);

    // logout only revokes the refresh token chain; the still-unexpired access
    // token (JWT, stateless) legitimately keeps working until its own TTL —
    // reuse it instead of spending another login out of the shared budget.
    const changed = await request(server())
      .post('/api/v1/auth/change-password')
      .set(auth())
      .send({ currentPassword: pendingPassword, newPassword });
    expect(changed.status).toBe(200);
    expect(changed.body.accessToken).toEqual(expect.any(String));

    // The token used to submit the change still has mustChangePassword=true
    // baked into its signed claims (JWTs don't update retroactively) — a
    // caller that kept using it instead of the freshly issued one would stay
    // 403'd forever despite having just satisfied the requirement.
    const allowedWithNewToken = await request(server())
      .get('/api/v1/condominial/units')
      .query({ condominiumId: condominium.id, page: 1, pageSize: 10 })
      .set('Authorization', `Bearer ${changed.body.accessToken}`);
    expect(allowedWithNewToken.status).toBe(200);

    const after = await login(pendingEmail, newPassword);
    expect(after.body.mustChangePassword).toBe(false);

    const allowed = await request(server())
      .get('/api/v1/condominial/units')
      .query({ condominiumId: condominium.id, page: 1, pageSize: 10 })
      .set('Authorization', `Bearer ${after.body.accessToken}`);
    expect(allowed.status).toBe(200);
  });
});
