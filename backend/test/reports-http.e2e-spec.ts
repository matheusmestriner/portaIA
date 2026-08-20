import cookieParser from 'cookie-parser';
import request from 'supertest';
import { Test, type TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { DeliveryStatus, OccurrenceSeverity, UserRole } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PasswordHasherService } from '../src/auth/password-hasher.service';

describe('Reports HTTP (integration)', () => {
  let moduleRef: TestingModule;
  let app: INestApplication;
  let prisma: PrismaService;

  let resale: { id: string };
  let client: { id: string };
  let condominium: { id: string };
  let otherCondominium: { id: string };
  let unit: { id: string };

  const clientAdminEmail = 'client-admin-reports-it@example.com';
  const clientAdminPassword = 'a-strong-password-reports-123';
  let accessToken: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1', { exclude: ['health/live', 'health/ready'] });
    await app.init();

    prisma = moduleRef.get(PrismaService);
    const hasher = moduleRef.get(PasswordHasherService);

    resale = await prisma.resale.create({ data: { name: 'Revenda Reports', slug: 'revenda-reports-it' } });
    client = await prisma.client.create({
      data: { resaleId: resale.id, name: 'Cliente Reports', slug: 'cliente-reports-it' },
    });
    condominium = await prisma.condominium.create({
      data: { resaleId: resale.id, clientId: client.id, name: 'Condo Reports', slug: 'condo-reports-it' },
    });
    otherCondominium = await prisma.condominium.create({
      data: { resaleId: resale.id, clientId: client.id, name: 'Condo Reports Other', slug: 'condo-reports-other-it' },
    });
    unit = await prisma.unit.create({
      data: { condominiumId: condominium.id, resaleId: resale.id, clientId: client.id, identifier: 'R-101' },
    });
    const otherUnit = await prisma.unit.create({
      data: { condominiumId: otherCondominium.id, resaleId: resale.id, clientId: client.id, identifier: 'R-201' },
    });

    // Data in the target condominium.
    await prisma.delivery.create({
      data: {
        unitId: unit.id,
        resaleId: resale.id,
        clientId: client.id,
        condominiumId: condominium.id,
        description: 'Pacote report',
        status: DeliveryStatus.PENDING,
      },
    });
    await prisma.occurrence.create({
      data: {
        resaleId: resale.id,
        clientId: client.id,
        condominiumId: condominium.id,
        title: 'Vazamento',
        description: 'x',
        severity: OccurrenceSeverity.HIGH,
        reportedBy: 'Síndico',
      },
    });
    await prisma.provider.create({
      data: {
        resaleId: resale.id,
        clientId: client.id,
        condominiumId: condominium.id,
        name: 'Prestador Reports',
        document: '11111111111',
        isActive: true,
      },
    });

    // Noise in a sibling condominium — must never leak into the target's report.
    await prisma.delivery.create({
      data: {
        unitId: otherUnit.id,
        resaleId: resale.id,
        clientId: client.id,
        condominiumId: otherCondominium.id,
        description: 'Pacote outro condo',
        status: DeliveryStatus.PENDING,
      },
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
    await prisma.delivery.deleteMany({ where: { clientId: client.id } });
    await prisma.occurrence.deleteMany({ where: { clientId: client.id } });
    await prisma.provider.deleteMany({ where: { clientId: client.id } });
    await prisma.unit.deleteMany({ where: { clientId: client.id } });
    await prisma.refreshToken.deleteMany({ where: { user: { email: clientAdminEmail } } });
    await prisma.user.deleteMany({ where: { email: clientAdminEmail } });
    await prisma.condominium.deleteMany({ where: { clientId: client.id } });
    await prisma.client.deleteMany({ where: { id: client.id } });
    await prisma.resale.deleteMany({ where: { id: resale.id } });
    await app.close();
    await moduleRef.close();
  });

  const server = () => app.getHttpServer();
  const auth = () => ({ Authorization: `Bearer ${accessToken}` });

  it('returns the overview counts scoped to the target condominium only', async () => {
    const res = await request(server())
      .get('/api/v1/reports/overview')
      .query({ condominiumId: condominium.id })
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body.pendingDeliveries).toBe(1);
    expect(res.body.openOccurrences).toBe(1);
    expect(res.body.activeProviders).toBe(1);
    expect(res.body.units).toBe(1);
  });

  it('breaks deliveries down by status without leaking the sibling condominium', async () => {
    const res = await request(server())
      .get('/api/v1/reports/deliveries')
      .query({ condominiumId: condominium.id })
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.byGroup.PENDING).toBe(1);
  });

  it('breaks occurrences down by severity', async () => {
    const res = await request(server())
      .get('/api/v1/reports/occurrences')
      .query({ condominiumId: condominium.id })
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.byGroup.HIGH).toBe(1);
  });

  it('rejects a report request with no access token', async () => {
    const res = await request(server()).get('/api/v1/reports/overview').query({ condominiumId: condominium.id });
    expect(res.status).toBe(401);
  });
});
