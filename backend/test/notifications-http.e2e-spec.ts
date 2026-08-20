import cookieParser from 'cookie-parser';
import request from 'supertest';
import { Test, type TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PasswordHasherService } from '../src/auth/password-hasher.service';

describe('Notifications HTTP (integration)', () => {
  let moduleRef: TestingModule;
  let app: INestApplication;
  let prisma: PrismaService;

  let resale: { id: string };
  let client: { id: string };
  let condominium: { id: string };
  let unit: { id: string };

  const condoManagerEmail = 'condo-manager-notifications-it@example.com';
  const condoManagerPassword = 'a-strong-password-notif-123';
  let accessToken: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1', { exclude: ['health/live', 'health/ready'] });
    await app.init();

    prisma = moduleRef.get(PrismaService);
    const hasher = moduleRef.get(PasswordHasherService);

    resale = await prisma.resale.create({ data: { name: 'Revenda Notif', slug: 'revenda-notif-it' } });
    client = await prisma.client.create({
      data: { resaleId: resale.id, name: 'Cliente Notif', slug: 'cliente-notif-it' },
    });
    condominium = await prisma.condominium.create({
      data: { resaleId: resale.id, clientId: client.id, name: 'Condo Notif', slug: 'condo-notif-it' },
    });
    unit = await prisma.unit.create({
      data: { condominiumId: condominium.id, resaleId: resale.id, clientId: client.id, identifier: 'N-101' },
    });

    // Two residents with a phone, one without — only the two with a phone
    // should get an outbox entry.
    await prisma.resident.create({
      data: {
        unitId: unit.id,
        resaleId: resale.id,
        clientId: client.id,
        condominiumId: condominium.id,
        name: 'Morador Com Telefone 1',
        phone: '+5511900000001',
        isPrimary: true,
      },
    });
    await prisma.resident.create({
      data: {
        unitId: unit.id,
        resaleId: resale.id,
        clientId: client.id,
        condominiumId: condominium.id,
        name: 'Morador Com Telefone 2',
        phone: '+5511900000002',
        isPrimary: false,
      },
    });
    await prisma.resident.create({
      data: {
        unitId: unit.id,
        resaleId: resale.id,
        clientId: client.id,
        condominiumId: condominium.id,
        name: 'Morador Sem Telefone',
        phone: null,
        isPrimary: false,
      },
    });

    await prisma.user.create({
      data: {
        email: condoManagerEmail,
        passwordHash: await hasher.hash(condoManagerPassword),
        role: UserRole.CONDO_MANAGER,
        resaleId: resale.id,
        clientId: client.id,
        condominiumId: condominium.id,
        mustChangePassword: false,
      },
    });
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: condoManagerEmail, password: condoManagerPassword });
    accessToken = login.body.accessToken;
  });

  afterAll(async () => {
    await prisma.idempotencyKey.deleteMany({});
    await prisma.auditLog.deleteMany({ where: { tenantClientId: client.id } });
    await prisma.notificationOutboxEntry.deleteMany({ where: { clientId: client.id } });
    await prisma.announcement.deleteMany({ where: { clientId: client.id } });
    await prisma.resident.deleteMany({ where: { clientId: client.id } });
    await prisma.refreshToken.deleteMany({ where: { user: { email: condoManagerEmail } } });
    await prisma.user.deleteMany({ where: { email: condoManagerEmail } });
    await prisma.unit.deleteMany({ where: { id: unit.id } });
    await prisma.condominium.deleteMany({ where: { id: condominium.id } });
    await prisma.client.deleteMany({ where: { id: client.id } });
    await prisma.resale.deleteMany({ where: { id: resale.id } });
    await app.close();
    await moduleRef.close();
  });

  const server = () => app.getHttpServer();
  const auth = () => ({ Authorization: `Bearer ${accessToken}` });

  it('reports the WhatsApp connection as not configured, honestly', async () => {
    const res = await request(server()).get('/api/v1/notifications/whatsapp/status').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.connected).toBe(false);
    expect(res.body.reason).toBeDefined();
  });

  it('creates an announcement, fans it out only to residents with a phone, and marks every attempt FAILED with a clear reason', async () => {
    const created = await request(server())
      .post('/api/v1/notifications/announcements')
      .set(auth())
      .set('Idempotency-Key', 'announcement-key-1')
      .send({ condominiumId: condominium.id, title: 'Manutenção', body: 'Elevador fora do ar amanhã.' });
    expect(created.status).toBe(201);
    expect(created.body.queued).toBe(2);

    const outbox = await request(server())
      .get('/api/v1/notifications/outbox')
      .query({ condominiumId: condominium.id, page: 1, pageSize: 20 })
      .set(auth());
    expect(outbox.status).toBe(200);
    expect(outbox.body.items).toHaveLength(2);
    for (const entry of outbox.body.items) {
      expect(entry.status).toBe('FAILED');
      expect(entry.channel).toBe('WHATSAPP');
      expect(entry.error).toMatch(/não configurad[oa]/i);
    }

    const announcements = await request(server())
      .get('/api/v1/notifications/announcements')
      .query({ condominiumId: condominium.id, page: 1, pageSize: 10 })
      .set(auth());
    expect(announcements.status).toBe(200);
    expect(announcements.body.items.some((a: { id: string }) => a.id === created.body.announcement.id)).toBe(true);
  });

  it('denies a role without COMMUNICATION_MANAGE from creating an announcement', async () => {
    const hasher = moduleRef.get(PasswordHasherService);
    const operatorEmail = 'condo-operator-notifications-it@example.com';
    await prisma.user.create({
      data: {
        email: operatorEmail,
        passwordHash: await hasher.hash('a-strong-password-op-123'),
        role: UserRole.CONDO_OPERATOR,
        resaleId: resale.id,
        clientId: client.id,
        condominiumId: condominium.id,
        mustChangePassword: false,
      },
    });
    const login = await request(server())
      .post('/api/v1/auth/login')
      .send({ email: operatorEmail, password: 'a-strong-password-op-123' });

    const res = await request(server())
      .post('/api/v1/notifications/announcements')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .set('Idempotency-Key', 'announcement-denied-1')
      .send({ condominiumId: condominium.id, title: 'x', body: 'x' });
    expect(res.status).toBe(403);

    await prisma.refreshToken.deleteMany({ where: { user: { email: operatorEmail } } });
    await prisma.user.deleteMany({ where: { email: operatorEmail } });
  });
});
