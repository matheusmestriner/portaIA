import cookieParser from 'cookie-parser';
import request from 'supertest';
import { Test, type TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PasswordHasherService } from '../src/auth/password-hasher.service';

/**
 * Only two logins for the whole file (super admin + one resale admin,
 * reused across every sub-test) — the login endpoint is throttled to
 * 5/min by design, and this file exercises many different assertions
 * against the same two roles, so it authenticates once each and reuses
 * the tokens rather than logging in per test.
 */
describe('Platform admin HTTP: audit logs, feature flags, white-label, plans (integration)', () => {
  let moduleRef: TestingModule;
  let app: INestApplication;
  let prisma: PrismaService;
  let hasher: PasswordHasherService;

  const superAdminEmail = 'super-admin-platform-it@example.com';
  const superAdminPassword = 'a-strong-password-super-plat-123';
  let superAdminToken: string;

  const resaleAdminEmail = 'resale-admin-platform-it@example.com';
  const resaleAdminPassword = 'a-strong-password-rap-123';
  let resaleAdminToken: string;

  let resaleA: { id: string };
  let resaleB: { id: string };

  const cleanupEmails: string[] = [superAdminEmail, resaleAdminEmail];
  const cleanupResaleIds: string[] = [];
  const cleanupPlanIds: string[] = [];

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1', { exclude: ['health/live', 'health/ready'] });
    await app.init();

    prisma = moduleRef.get(PrismaService);
    hasher = moduleRef.get(PasswordHasherService);

    resaleA = await prisma.resale.create({ data: { name: 'Revenda Plat A', slug: 'revenda-plat-a-it' } });
    resaleB = await prisma.resale.create({ data: { name: 'Revenda Plat B', slug: 'revenda-plat-b-it' } });
    cleanupResaleIds.push(resaleA.id, resaleB.id);

    await prisma.user.create({
      data: {
        email: superAdminEmail,
        passwordHash: await hasher.hash(superAdminPassword),
        role: UserRole.SUPER_ADMIN,
        mustChangePassword: false,
      },
    });
    await prisma.user.create({
      data: {
        email: resaleAdminEmail,
        passwordHash: await hasher.hash(resaleAdminPassword),
        role: UserRole.RESALE_ADMIN,
        resaleId: resaleA.id,
        mustChangePassword: false,
      },
    });

    const superLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: superAdminEmail, password: superAdminPassword });
    superAdminToken = superLogin.body.accessToken;

    const resaleLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: resaleAdminEmail, password: resaleAdminPassword });
    resaleAdminToken = resaleLogin.body.accessToken;
  });

  afterAll(async () => {
    await prisma.idempotencyKey.deleteMany({});
    await prisma.auditLog.deleteMany({
      where: { OR: [{ tenantResaleId: { in: cleanupResaleIds } }, { actorUserId: { not: null } }] },
    });
    await prisma.whiteLabelConfig.deleteMany({ where: { scopeId: { in: cleanupResaleIds } } });
    await prisma.whiteLabelConfig.deleteMany({ where: { scope: 'GLOBAL' } });
    await prisma.featureFlag.deleteMany({ where: { scopeId: { in: cleanupResaleIds } } });
    await prisma.featureFlag.deleteMany({ where: { scope: 'GLOBAL' } });
    await prisma.refreshToken.deleteMany({
      where: { OR: [{ user: { email: { in: cleanupEmails } } }, { user: { resaleId: { in: cleanupResaleIds } } }] },
    });
    await prisma.user.deleteMany({ where: { OR: [{ email: { in: cleanupEmails } }, { resaleId: { in: cleanupResaleIds } }] } });
    await prisma.resale.deleteMany({ where: { id: { in: cleanupResaleIds } } });
    await prisma.plan.deleteMany({ where: { id: { in: cleanupPlanIds } } });
    await app.close();
    await moduleRef.close();
  });

  const server = () => app.getHttpServer();
  const superAdminAuth = () => ({ Authorization: `Bearer ${superAdminToken}` });
  const resaleAdminAuth = () => ({ Authorization: `Bearer ${resaleAdminToken}` });

  it('lets a super admin set a global feature flag and read it back in the effective list', async () => {
    const set = await request(server())
      .put('/api/v1/platform/feature-flags')
      .set(superAdminAuth())
      .set('Idempotency-Key', 'flag-key-1')
      .send({ key: 'whatsapp_adapter', scope: 'GLOBAL', enabled: true });
    expect(set.status).toBe(200);
    expect(set.body.scope).toBe('GLOBAL');
    expect(set.body.enabled).toBe(true);

    const list = await request(server()).get('/api/v1/platform/feature-flags').set(superAdminAuth());
    expect(list.status).toBe(200);
    expect(list.body.some((f: { key: string; scope: string }) => f.key === 'whatsapp_adapter' && f.scope === 'GLOBAL')).toBe(
      true,
    );
  });

  it('blocks a resale admin from setting a GLOBAL feature flag', async () => {
    const res = await request(server())
      .put('/api/v1/platform/feature-flags')
      .set(resaleAdminAuth())
      .set('Idempotency-Key', 'flag-key-2')
      .send({ key: 'some_flag', scope: 'GLOBAL', enabled: true });
    expect(res.status).toBe(403);
  });

  it("forces a resale admin's RESALE-scope flag write onto their own resale, and hides other resales' flags from their list", async () => {
    // Also set one under resaleB directly (as super admin) so we can prove
    // the resale-A admin's list doesn't leak it.
    await request(server())
      .put('/api/v1/platform/feature-flags')
      .set(superAdminAuth())
      .set('Idempotency-Key', 'flag-key-resaleb')
      .send({ key: 'resale_b_only_flag', scope: 'RESALE', scopeId: resaleB.id, enabled: true });

    const setOwn = await request(server())
      .put('/api/v1/platform/feature-flags')
      .set(resaleAdminAuth())
      .set('Idempotency-Key', 'flag-key-3')
      .send({ key: 'own_resale_flag', scope: 'RESALE', enabled: true });
    expect(setOwn.status).toBe(200);
    expect(setOwn.body.scopeId).toBe(resaleA.id);

    const list = await request(server()).get('/api/v1/platform/feature-flags').set(resaleAdminAuth());
    expect(list.status).toBe(200);
    expect(list.body.some((f: { key: string }) => f.key === 'own_resale_flag')).toBe(true);
    expect(list.body.some((f: { key: string }) => f.key === 'resale_b_only_flag')).toBe(false);
  });

  it('merges white-label fields from GLOBAL down to RESALE (field-level, not row replacement)', async () => {
    await request(server())
      .put('/api/v1/platform/white-label')
      .set(superAdminAuth())
      .set('Idempotency-Key', 'wl-key-1')
      .send({ scope: 'GLOBAL', primaryColor: '#111111', secondaryColor: '#222222' });

    await request(server())
      .put('/api/v1/platform/white-label')
      .set(resaleAdminAuth())
      .set('Idempotency-Key', 'wl-key-2')
      .send({ scope: 'RESALE', brandName: 'Marca da Revenda A' });

    const effective = await request(server()).get('/api/v1/platform/white-label').set(resaleAdminAuth());
    expect(effective.status).toBe(200);
    expect(effective.body.brandName).toBe('Marca da Revenda A');
    // Colors inherited from GLOBAL even though the resale only set brandName.
    expect(effective.body.primaryColor).toBe('#111111');
    expect(effective.body.secondaryColor).toBe('#222222');
  });

  it('lets a super admin create a plan and provision it to a resale', async () => {
    const plan = await request(server())
      .post('/api/v1/platform/plans')
      .set(superAdminAuth())
      .set('Idempotency-Key', 'plan-key-1')
      .send({ key: 'plano-essencial-it', name: 'Plano Essencial', modules: ['gatehouse', 'security'] });
    expect(plan.status).toBe(201);
    cleanupPlanIds.push(plan.body.id);

    const assigned = await request(server())
      .post('/api/v1/platform/plans/assign')
      .set(superAdminAuth())
      .set('Idempotency-Key', 'plan-key-2')
      .send({ resaleId: resaleA.id, planId: plan.body.id });
    expect(assigned.status).toBe(201);
    expect(assigned.body.planId).toBe(plan.body.id);
  });

  it('denies a resale admin from managing the plan catalog', async () => {
    const res = await request(server())
      .post('/api/v1/platform/plans')
      .set(resaleAdminAuth())
      .set('Idempotency-Key', 'plan-key-denied')
      .send({ key: 'x-y', name: 'x' });
    expect(res.status).toBe(403);
  });

  it("scopes the audit log list to the acting resale admin's resale", async () => {
    const res = await request(server())
      .get('/api/v1/platform/audit-logs')
      .query({ page: 1, pageSize: 50 })
      .set(resaleAdminAuth());
    expect(res.status).toBe(200);
    expect(
      res.body.items.every(
        (l: { tenantResaleId: string | null }) => l.tenantResaleId === null || l.tenantResaleId === resaleA.id,
      ),
    ).toBe(true);
  });
});
