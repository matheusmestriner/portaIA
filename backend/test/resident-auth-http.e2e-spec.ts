import request from 'supertest';
import { Test, type TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PasswordHasherService } from '../src/auth/password-hasher.service';

/**
 * Espelha auth-http.e2e-spec.ts (equipe), adaptado para o fluxo mobile-first
 * do morador: refresh no corpo (não cookie), sem CSRF. Cobre login, rotação
 * de refresh, revogação em reuso (theft detection) e logout revogando tudo.
 *
 * Login é limitado a 5/min por IP (mesmo handler /resident-auth/login para
 * todo o arquivo) — como o auth-http.e2e-spec.ts de equipe já documenta,
 * o arquivo inteiro compartilha esse orçamento. Mantido a 4 chamadas totais
 * (1 + 1 + 2) reaproveitando sessão entre passos do mesmo teste em vez de
 * logar de novo a cada `it()`.
 */
describe('Resident auth HTTP (integration)', () => {
  let moduleRef: TestingModule;
  let app: INestApplication;
  let prisma: PrismaService;
  let hasher: PasswordHasherService;

  let resale: { id: string };
  let client: { id: string };
  let condominium: { id: string };
  let unit: { id: string };

  const activeEmail = 'resident-auth-http-it-active@example.com';
  const activePassword = 'a-strong-password-resident-http-1';

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1', { exclude: ['health/live', 'health/ready'] });
    await app.init();

    prisma = moduleRef.get(PrismaService);
    hasher = moduleRef.get(PasswordHasherService);

    resale = await prisma.resale.create({ data: { name: 'Revenda Resident Auth HTTP', slug: 'revenda-resident-auth-http-it' } });
    client = await prisma.client.create({
      data: { name: 'Cliente Resident Auth HTTP', slug: 'cliente-resident-auth-http-it', resaleId: resale.id },
    });
    condominium = await prisma.condominium.create({
      data: { name: 'Condo Resident Auth HTTP', slug: 'condo-resident-auth-http-it', clientId: client.id, resaleId: resale.id },
    });
    unit = await prisma.unit.create({
      data: { condominiumId: condominium.id, resaleId: resale.id, clientId: client.id, identifier: '101' },
    });

    await prisma.resident.create({
      data: {
        unitId: unit.id,
        resaleId: resale.id,
        clientId: client.id,
        condominiumId: condominium.id,
        name: 'Ana Ativa',
        email: activeEmail,
        passwordHash: await hasher.hash(activePassword),
        mustChangePassword: false,
      },
    });
  });

  afterAll(async () => {
    await prisma.residentRefreshToken.deleteMany({ where: { resident: { condominiumId: condominium.id } } });
    await prisma.resident.deleteMany({ where: { condominiumId: condominium.id } });
    await prisma.unit.deleteMany({ where: { id: unit.id } });
    await prisma.condominium.deleteMany({ where: { id: condominium.id } });
    await prisma.client.deleteMany({ where: { id: client.id } });
    await prisma.resale.deleteMany({ where: { id: resale.id } });
    await app.close();
    await moduleRef.close();
  });

  const server = () => app.getHttpServer();

  async function login(email: string, password: string) {
    const res = await request(server()).post('/api/v1/resident-auth/login').send({ email, password });
    return { status: res.status, body: res.body as { accessToken: string; refreshToken: string; mustChangePassword: boolean } };
  }

  it('rejects wrong password with a generic message', async () => {
    const res = await login(activeEmail, 'definitely-wrong');
    expect(res.status).toBe(401);
  });

  it('logs in (tokens in body, no cookies), refreshes with rotation, and detects reuse as theft', async () => {
    const session = await login(activeEmail, activePassword);
    expect(session.status).toBe(200);
    expect(session.body.accessToken).toEqual(expect.any(String));
    expect(session.body.refreshToken).toEqual(expect.any(String));
    expect(session.body.mustChangePassword).toBe(false);

    const rotated = await request(server())
      .post('/api/v1/resident-auth/refresh')
      .send({ refreshToken: session.body.refreshToken });
    expect(rotated.status).toBe(200);
    expect(rotated.body.refreshToken).not.toBe(session.body.refreshToken);

    // Re-presenting the OLD (already-rotated) token signals theft.
    const replay = await request(server())
      .post('/api/v1/resident-auth/refresh')
      .send({ refreshToken: session.body.refreshToken });
    expect(replay.status).toBe(401);

    // The token from the successful rotation must also be dead now.
    const afterTheftDetection = await request(server())
      .post('/api/v1/resident-auth/refresh')
      .send({ refreshToken: rotated.body.refreshToken });
    expect(afterTheftDetection.status).toBe(401);
  });

  it('logout revokes every active refresh token for the resident, not just one device', async () => {
    const sessionA = await login(activeEmail, activePassword);
    const sessionB = await login(activeEmail, activePassword);

    await request(server())
      .post('/api/v1/resident-auth/logout')
      .set('Authorization', `Bearer ${sessionA.body.accessToken}`)
      .expect(204);

    const refreshB = await request(server())
      .post('/api/v1/resident-auth/refresh')
      .send({ refreshToken: sessionB.body.refreshToken });
    expect(refreshB.status).toBe(401);
  });
});
