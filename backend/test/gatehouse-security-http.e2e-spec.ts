import cookieParser from 'cookie-parser';
import request from 'supertest';
import { Test, type TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PasswordHasherService } from '../src/auth/password-hasher.service';

describe('Gatehouse + Security HTTP (integration)', () => {
  let moduleRef: TestingModule;
  let app: INestApplication;
  let prisma: PrismaService;

  let resale: { id: string };
  let client: { id: string };
  let condominium: { id: string };
  let unit: { id: string };

  const operatorEmail = 'condo-operator-http-it@example.com';
  const operatorPassword = 'a-strong-password-http-op-123';
  let operatorAccessToken: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1', { exclude: ['health/live', 'health/ready'] });
    await app.init();

    prisma = moduleRef.get(PrismaService);
    const hasher = moduleRef.get(PasswordHasherService);

    resale = await prisma.resale.create({ data: { name: 'Revenda GH HTTP', slug: 'revenda-gh-http-it' } });
    client = await prisma.client.create({
      data: { name: 'Cliente GH HTTP', slug: 'cliente-gh-http-it', resaleId: resale.id },
    });
    condominium = await prisma.condominium.create({
      data: { name: 'Condo GH HTTP', slug: 'condo-gh-http-it', clientId: client.id, resaleId: resale.id },
    });
    unit = await prisma.unit.create({
      data: { condominiumId: condominium.id, resaleId: resale.id, clientId: client.id, identifier: '101' },
    });

    await prisma.user.create({
      data: {
        email: operatorEmail,
        passwordHash: await hasher.hash(operatorPassword),
        role: UserRole.CONDO_OPERATOR,
        resaleId: resale.id,
        clientId: client.id,
        condominiumId: condominium.id,
        mustChangePassword: false,
      },
    });

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: operatorEmail, password: operatorPassword });
    operatorAccessToken = login.body.accessToken;
  });

  afterAll(async () => {
    await prisma.idempotencyKey.deleteMany({});
    await prisma.auditLog.deleteMany({ where: { tenantClientId: client.id } });
    await prisma.visitorAuthorization.deleteMany({ where: { condominiumId: condominium.id } });
    await prisma.visitor.deleteMany({ where: { condominiumId: condominium.id } });
    await prisma.delivery.deleteMany({ where: { condominiumId: condominium.id } });
    await prisma.keyRecord.deleteMany({ where: { condominiumId: condominium.id } });
    await prisma.occurrence.deleteMany({ where: { condominiumId: condominium.id } });
    await prisma.panicAlert.deleteMany({ where: { condominiumId: condominium.id } });
    await prisma.blockListEntry.deleteMany({ where: { condominiumId: condominium.id } });
    await prisma.refreshToken.deleteMany({ where: { user: { email: operatorEmail } } });
    await prisma.user.deleteMany({ where: { email: operatorEmail } });
    await prisma.unit.deleteMany({ where: { id: unit.id } });
    await prisma.condominium.deleteMany({ where: { id: condominium.id } });
    await prisma.client.deleteMany({ where: { id: client.id } });
    await prisma.resale.deleteMany({ where: { id: resale.id } });
    await app.close();
    await moduleRef.close();
  });

  const server = () => app.getHttpServer();
  const auth = () => ({ Authorization: `Bearer ${operatorAccessToken}` });

  it('a condo operator (no REPORTS_VIEW) can list units — needed to pick a unit for any gatehouse/security action', async () => {
    const res = await request(server())
      .get('/api/v1/condominial/units')
      .query({ condominiumId: condominium.id, page: 1, pageSize: 10 })
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body.items.some((u: { id: string }) => u.id === unit.id)).toBe(true);
  });

  it('registers a visitor and lists it back', async () => {
    const res = await request(server())
      .post('/api/v1/gatehouse/visitors')
      .set(auth())
      .set('Idempotency-Key', 'visitor-key-1')
      .send({
        unitId: unit.id,
        name: 'Maria Visitante',
        validFrom: new Date().toISOString(),
        validUntil: new Date(Date.now() + 3600_000).toISOString(),
      });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Maria Visitante');

    const list = await request(server())
      .get('/api/v1/gatehouse/visitors')
      .query({ condominiumId: condominium.id, page: 1, pageSize: 10 })
      .set(auth());
    expect(list.status).toBe(200);
    expect(list.body.items.some((v: { id: string }) => v.id === res.body.id)).toBe(true);
  });

  it('creates a delivery, issues a pickup credential once, and never re-exposes it in listings', async () => {
    const created = await request(server())
      .post('/api/v1/gatehouse/deliveries')
      .set(auth())
      .set('Idempotency-Key', 'delivery-key-1')
      .send({ unitId: unit.id, description: 'Pacote HTTP' });
    expect(created.status).toBe(201);
    expect(created.body.delivery.status).toBe('PENDING');
    // A credencial em claro só existe nesta resposta.
    expect(created.body.pickupCode).toMatch(/^[0-9]{6}$/);
    expect(created.body.qrPayload).toContain(created.body.delivery.id);
    expect(created.body.expiresAt).not.toBeNull();

    const list = await request(server())
      .get('/api/v1/gatehouse/deliveries')
      .query({ condominiumId: condominium.id, status: 'PENDING', page: 1, pageSize: 10 })
      .set(auth());
    expect(list.status).toBe(200);
    const listed = list.body.items.find((d: { id: string }) => d.id === created.body.delivery.id);
    expect(listed).toBeDefined();
    // A listagem nunca devolve o código em claro, só os 4 últimos dígitos.
    expect(listed.pickupCode).toBeUndefined();
    expect(listed.pickupCodeLast4).toBe(created.body.pickupCode.slice(-4));
    // Um código errado não resgata nada.
    const wrongCode = await request(server())
      .post('/api/v1/gatehouse/deliveries/redeem')
      .set(auth())
      .set('Idempotency-Key', 'redeem-wrong-1')
      .send({ credential: '000000', pickedUpBy: 'Ninguém' });
    expect(wrongCode.status).toBe(404);
  });

  it('redeems a delivery by the code the resident quotes at the gatehouse', async () => {
    const created = await request(server())
      .post('/api/v1/gatehouse/deliveries')
      .set(auth())
      .set('Idempotency-Key', 'delivery-key-redeem')
      .send({ unitId: unit.id, description: 'Pacote com credencial' });
    expect(created.status).toBe(201);

    const redeemed = await request(server())
      .post('/api/v1/gatehouse/deliveries/redeem')
      .set(auth())
      .set('Idempotency-Key', 'redeem-key-1')
      .send({ credential: created.body.pickupCode, pickedUpBy: 'Morador 101' });
    expect(redeemed.status).toBe(201);
    expect(redeemed.body.id).toBe(created.body.delivery.id);
    expect(redeemed.body.status).toBe('COLLECTED');
    expect(redeemed.body.pickedUpBy).toBe('Morador 101');

    // A mesma credencial não pode ser usada duas vezes.
    const replay = await request(server())
      .post('/api/v1/gatehouse/deliveries/redeem')
      .set(auth())
      .set('Idempotency-Key', 'redeem-key-2')
      .send({ credential: created.body.pickupCode, pickedUpBy: 'Outra pessoa' });
    expect(replay.status).toBe(400);
  });

  it('redeems a delivery by the scanned QR payload and rejects an unknown credential', async () => {
    const created = await request(server())
      .post('/api/v1/gatehouse/deliveries')
      .set(auth())
      .set('Idempotency-Key', 'delivery-key-qr')
      .send({ unitId: unit.id, description: 'Pacote via QR' });

    const redeemed = await request(server())
      .post('/api/v1/gatehouse/deliveries/redeem')
      .set(auth())
      .set('Idempotency-Key', 'redeem-qr-1')
      .send({ credential: created.body.qrPayload, pickedUpBy: 'Morador via app' });
    expect(redeemed.status).toBe(201);
    expect(redeemed.body.status).toBe('COLLECTED');

    const unknown = await request(server())
      .post('/api/v1/gatehouse/deliveries/redeem')
      .set(auth())
      .set('Idempotency-Key', 'redeem-unknown-1')
      .send({ credential: '000000', pickedUpBy: 'Ninguém' });
    expect(unknown.status).toBe(404);
  });

  it('creates a key, checks it out, and returns it', async () => {
    const created = await request(server())
      .post('/api/v1/gatehouse/keys')
      .set(auth())
      .set('Idempotency-Key', 'key-create-1')
      .send({ unitId: unit.id, label: 'Chave reserva HTTP' });
    expect(created.status).toBe(201);

    const checkedOut = await request(server())
      .post(`/api/v1/gatehouse/keys/${created.body.id}/check-out`)
      .set(auth())
      .set('Idempotency-Key', 'key-checkout-1')
      .send({ checkedOutTo: 'João Prestador' });
    expect(checkedOut.status).toBe(201);
    expect(checkedOut.body.status).toBe('CHECKED_OUT');

    const returned = await request(server())
      .post(`/api/v1/gatehouse/keys/${created.body.id}/return`)
      .set(auth())
      .set('Idempotency-Key', 'key-return-1')
      .send();
    expect(returned.status).toBe(201);
    expect(returned.body.status).toBe('WITH_GATEHOUSE');

    const list = await request(server())
      .get('/api/v1/gatehouse/keys')
      .query({ condominiumId: condominium.id, status: 'WITH_GATEHOUSE', page: 1, pageSize: 10 })
      .set(auth());
    expect(list.status).toBe(200);
    expect(list.body.items.some((k: { id: string }) => k.id === created.body.id)).toBe(true);
  });

  it('reports an occurrence and lists it back, filtered by status', async () => {
    const created = await request(server())
      .post('/api/v1/security/occurrences')
      .set(auth())
      .set('Idempotency-Key', 'occ-create-1')
      .send({ condominiumId: condominium.id, title: 'Barulho', description: 'Som alto', reportedBy: 'Porteiro HTTP' });
    expect(created.status).toBe(201);
    expect(created.body.status).toBe('OPEN');

    const list = await request(server())
      .get('/api/v1/security/occurrences')
      .query({ condominiumId: condominium.id, status: 'OPEN', page: 1, pageSize: 10 })
      .set(auth());
    expect(list.status).toBe(200);
    expect(list.body.items.some((o: { id: string }) => o.id === created.body.id)).toBe(true);
  });

  it('denies a gatehouse-only actor from reporting an occurrence (needs SECURITY_OPERATE)', async () => {
    // CONDO_OPERATOR has both GATEHOUSE_OPERATE and SECURITY_OPERATE in the
    // current role matrix, so use a role that genuinely lacks it.
    const hasher = moduleRef.get(PasswordHasherService);
    const reportOnlyEmail = 'client-operator-http-it@example.com';
    await prisma.user.create({
      data: {
        email: reportOnlyEmail,
        passwordHash: await hasher.hash('a-strong-password-ro-123'),
        role: UserRole.CLIENT_OPERATOR,
        resaleId: resale.id,
        clientId: client.id,
        mustChangePassword: false,
      },
    });
    const login = await request(server())
      .post('/api/v1/auth/login')
      .send({ email: reportOnlyEmail, password: 'a-strong-password-ro-123' });

    const res = await request(server())
      .post('/api/v1/security/occurrences')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .set('Idempotency-Key', 'occ-denied-1')
      .send({ condominiumId: condominium.id, title: 'x', description: 'x', reportedBy: 'x' });
    expect(res.status).toBe(403);

    await prisma.user.deleteMany({ where: { email: reportOnlyEmail } });
  });

  it('denies an actor without SECURITY_OPERATE from listing occurrences', async () => {
    const hasher = moduleRef.get(PasswordHasherService);
    const reportOnlyEmail = 'client-operator-list-it@example.com';
    await prisma.user.create({
      data: {
        email: reportOnlyEmail,
        passwordHash: await hasher.hash('a-strong-password-ro-list-123'),
        role: UserRole.CLIENT_OPERATOR,
        resaleId: resale.id,
        clientId: client.id,
        mustChangePassword: false,
      },
    });
    const login = await request(server())
      .post('/api/v1/auth/login')
      .send({ email: reportOnlyEmail, password: 'a-strong-password-ro-list-123' });

    const res = await request(server())
      .get('/api/v1/security/occurrences')
      .query({ condominiumId: condominium.id, page: 1, pageSize: 10 })
      .set('Authorization', `Bearer ${login.body.accessToken}`);
    expect(res.status).toBe(403);

    await prisma.refreshToken.deleteMany({ where: { user: { email: reportOnlyEmail } } });
    await prisma.user.deleteMany({ where: { email: reportOnlyEmail } });
  });

  it('lets a gatehouse operator trigger a panic alert (no CONDOMINIUM_MANAGE/SECURITY_OPERATE-only gate) and list it back', async () => {
    const res = await request(server())
      .post('/api/v1/security/panic-alerts')
      .set(auth())
      .set('Idempotency-Key', 'panic-key-1')
      .send({ condominiumId: condominium.id, unitId: unit.id, triggeredBy: 'Porteiro HTTP' });
    expect(res.status).toBe(201);

    const list = await request(server())
      .get('/api/v1/security/panic-alerts')
      .query({ condominiumId: condominium.id, page: 1, pageSize: 10 })
      .set(auth());
    expect(list.status).toBe(200);
    expect(list.body.items.some((a: { id: string }) => a.id === res.body.id)).toBe(true);
  });

  it('adds a block list entry, rejects a duplicate document, and lists the entry back', async () => {
    const first = await request(server())
      .post('/api/v1/security/block-list')
      .set(auth())
      .set('Idempotency-Key', 'block-key-1')
      .send({ condominiumId: condominium.id, document: '999.888.777-66', reason: 'Teste HTTP' });
    expect(first.status).toBe(201);

    const duplicate = await request(server())
      .post('/api/v1/security/block-list')
      .set(auth())
      .set('Idempotency-Key', 'block-key-2')
      .send({ condominiumId: condominium.id, document: '999.888.777-66', reason: 'Duplicata' });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('CONFLICT');

    const list = await request(server())
      .get('/api/v1/security/block-list')
      .query({ condominiumId: condominium.id, page: 1, pageSize: 10 })
      .set(auth());
    expect(list.status).toBe(200);
    expect(list.body.items.some((b: { id: string }) => b.id === first.body.id)).toBe(true);
  });
});
