import request from 'supertest';
import { Test, type TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PasswordHasherService } from '../src/auth/password-hasher.service';

/**
 * Segundo arquivo (não o mesmo de resident-auth-http.e2e-spec.ts) por causa
 * do orçamento de 5 logins/min por IP no handler /resident-auth/login —
 * cada arquivo de teste HTTP roda numa TestingModule própria, com seu
 * próprio armazenamento de throttle em memória, então dividir em arquivos
 * reinicia o orçamento em vez de estourá-lo.
 *
 * Cobre o MustChangePasswordGuard do morador (bloqueio real no servidor,
 * não só cosmético no cliente) e o isolamento de audience entre token de
 * equipe e token de morador.
 */
describe('Resident auth guard + cross-audience HTTP (integration)', () => {
  let moduleRef: TestingModule;
  let app: INestApplication;
  let prisma: PrismaService;
  let hasher: PasswordHasherService;

  let resale: { id: string };
  let client: { id: string };
  let condominium: { id: string };
  let unit: { id: string };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1', { exclude: ['health/live', 'health/ready'] });
    await app.init();

    prisma = moduleRef.get(PrismaService);
    hasher = moduleRef.get(PasswordHasherService);

    resale = await prisma.resale.create({ data: { name: 'Revenda Resident Guard HTTP', slug: 'revenda-resident-guard-http-it' } });
    client = await prisma.client.create({
      data: { name: 'Cliente Resident Guard HTTP', slug: 'cliente-resident-guard-http-it', resaleId: resale.id },
    });
    condominium = await prisma.condominium.create({
      data: { name: 'Condo Resident Guard HTTP', slug: 'condo-resident-guard-http-it', clientId: client.id, resaleId: resale.id },
    });
    unit = await prisma.unit.create({
      data: { condominiumId: condominium.id, resaleId: resale.id, clientId: client.id, identifier: '101' },
    });
  });

  afterAll(async () => {
    await prisma.residentRefreshToken.deleteMany({ where: { resident: { condominiumId: condominium.id } } });
    await prisma.resident.deleteMany({ where: { condominiumId: condominium.id } });
    await prisma.user.deleteMany({ where: { condominiumId: condominium.id } });
    await prisma.unit.deleteMany({ where: { id: unit.id } });
    await prisma.condominium.deleteMany({ where: { id: condominium.id } });
    await prisma.client.deleteMany({ where: { id: client.id } });
    await prisma.resale.deleteMany({ where: { id: resale.id } });
    await app.close();
    await moduleRef.close();
  });

  const server = () => app.getHttpServer();

  it('blocks every resident/* route except /resident/me, change-password and logout while mustChangePassword is pending, unblocks after the change, and rejects cross-audience tokens', async () => {
    const pendingEmail = 'resident-auth-guard-http-it-pending@example.com';
    const pendingPassword = 'a-strong-password-resident-guard-1';
    const newPassword = 'a-new-strong-password-resident-guard-2';

    await prisma.resident.create({
      data: {
        unitId: unit.id,
        resaleId: resale.id,
        clientId: client.id,
        condominiumId: condominium.id,
        name: 'Bruno Pendente',
        email: pendingEmail,
        passwordHash: await hasher.hash(pendingPassword),
        mustChangePassword: true,
      },
    });

    const session = await request(server()).post('/api/v1/resident-auth/login').send({ email: pendingEmail, password: pendingPassword });
    expect(session.body.mustChangePassword).toBe(true);
    const auth = () => ({ Authorization: `Bearer ${session.body.accessToken}` });

    // /resident/me stays reachable even mid-pending (the app needs to know who's logged in).
    const me = await request(server()).get('/api/v1/resident/me').set(auth());
    expect(me.status).toBe(200);

    // An ordinary resident route must be rejected server-side.
    const blocked = await request(server()).get('/api/v1/resident/dashboard').set(auth());
    expect(blocked.status).toBe(403);

    const changed = await request(server())
      .post('/api/v1/resident-auth/change-password')
      .set(auth())
      .send({ currentPassword: pendingPassword, newPassword });
    expect(changed.status).toBe(200);

    // The token used to submit the change still carries mustChangePassword=true baked in.
    const stillBlockedWithOldToken = await request(server()).get('/api/v1/resident/dashboard').set(auth());
    expect(stillBlockedWithOldToken.status).toBe(403);

    const allowedWithNewToken = await request(server())
      .get('/api/v1/resident/dashboard')
      .set('Authorization', `Bearer ${changed.body.accessToken}`);
    expect(allowedWithNewToken.status).toBe(200);

    // Reuse this same (now password-changed) session as the resident token
    // for the cross-audience check below — no extra login call needed.
    const residentToken = changed.body.accessToken as string;

    const staffUser = await prisma.user.create({
      data: {
        email: 'resident-auth-guard-http-it-staff@example.com',
        passwordHash: await hasher.hash('a-strong-password-staff-1'),
        role: UserRole.CONDO_OPERATOR,
        resaleId: resale.id,
        clientId: client.id,
        condominiumId: condominium.id,
        mustChangePassword: false,
      },
    });
    const staffLogin = await request(server())
      .post('/api/v1/auth/login')
      .send({ email: staffUser.email, password: 'a-strong-password-staff-1' });
    expect(staffLogin.status).toBe(200);

    // Staff token against a resident-only route.
    const staffOnResident = await request(server())
      .get('/api/v1/resident/dashboard')
      .set('Authorization', `Bearer ${staffLogin.body.accessToken}`);
    expect(staffOnResident.status).toBe(401);

    // Resident token against a staff-only route.
    const residentOnStaff = await request(server())
      .get('/api/v1/condominial/units')
      .query({ condominiumId: condominium.id, page: 1, pageSize: 10 })
      .set('Authorization', `Bearer ${residentToken}`);
    expect(residentOnStaff.status).toBe(401);

    await prisma.refreshToken.deleteMany({ where: { userId: staffUser.id } });
  });
});
