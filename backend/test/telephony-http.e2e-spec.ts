import { createHmac, randomUUID } from 'crypto';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { Test, type TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PasswordHasherService } from '../src/auth/password-hasher.service';

describe('Telephony HTTP (integration)', () => {
  let moduleRef: TestingModule;
  let app: INestApplication;
  let prisma: PrismaService;

  let resale: { id: string };
  let client: { id: string };
  let condominium: { id: string };
  let unit8: { id: string };
  let unit5: { id: string };

  const managerEmail = 'condo-manager-telephony-it@example.com';
  const managerPassword = 'a-strong-password-tel-mgr-123';
  const clientAdminEmail = 'client-admin-telephony-it@example.com';
  const clientAdminPassword = 'a-strong-password-tel-adm-123';
  let managerToken: string;
  let clientAdminToken: string;

  const webhookSecret = process.env.TELEPHONY_WEBHOOK_SECRET as string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1', { exclude: ['health/live', 'health/ready'] });
    await app.init();

    prisma = moduleRef.get(PrismaService);
    const hasher = moduleRef.get(PasswordHasherService);

    resale = await prisma.resale.create({ data: { name: 'Revenda Telefonia', slug: 'revenda-telefonia-it' } });
    client = await prisma.client.create({
      data: { resaleId: resale.id, name: 'Cliente Telefonia', slug: 'cliente-telefonia-it' },
    });
    condominium = await prisma.condominium.create({
      data: { resaleId: resale.id, clientId: client.id, name: 'Condo Telefonia', slug: 'condo-telefonia-it' },
    });
    unit8 = await prisma.unit.create({
      data: { condominiumId: condominium.id, resaleId: resale.id, clientId: client.id, identifier: '8' },
    });
    unit5 = await prisma.unit.create({
      data: { condominiumId: condominium.id, resaleId: resale.id, clientId: client.id, identifier: '5' },
    });

    await prisma.user.create({
      data: {
        email: managerEmail,
        passwordHash: await hasher.hash(managerPassword),
        role: UserRole.CONDO_MANAGER,
        resaleId: resale.id,
        clientId: client.id,
        condominiumId: condominium.id,
        mustChangePassword: false,
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

    const managerLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: managerEmail, password: managerPassword });
    managerToken = managerLogin.body.accessToken;

    const clientAdminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: clientAdminEmail, password: clientAdminPassword });
    clientAdminToken = clientAdminLogin.body.accessToken;
  });

  afterAll(async () => {
    await prisma.idempotencyKey.deleteMany({});
    await prisma.auditLog.deleteMany({ where: { tenantClientId: client.id } });
    await prisma.recording.deleteMany({ where: { clientId: client.id } });
    await prisma.call.deleteMany({ where: { clientId: client.id } });
    await prisma.webhookNonce.deleteMany({});
    await prisma.extension.deleteMany({ where: { clientId: client.id } });
    await prisma.refreshToken.deleteMany({ where: { user: { email: { in: [managerEmail, clientAdminEmail] } } } });
    await prisma.user.deleteMany({ where: { email: { in: [managerEmail, clientAdminEmail] } } });
    await prisma.unit.deleteMany({ where: { condominiumId: condominium.id } });
    await prisma.condominium.deleteMany({ where: { id: condominium.id } });
    await prisma.client.deleteMany({ where: { id: client.id } });
    await prisma.resale.deleteMany({ where: { id: resale.id } });
    await app.close();
    await moduleRef.close();
  });

  const server = () => app.getHttpServer();
  const managerAuth = () => ({ Authorization: `Bearer ${managerToken}` });
  const clientAdminAuth = () => ({ Authorization: `Bearer ${clientAdminToken}` });

  function signedWebhookHeaders(body: unknown, overrides?: { timestamp?: number; nonce?: string; secret?: string }) {
    const timestamp = overrides?.timestamp ?? Date.now();
    const nonce = overrides?.nonce ?? randomUUID();
    const secret = overrides?.secret ?? webhookSecret;
    const raw = JSON.stringify(body);
    const signature = createHmac('sha256', secret).update(`${timestamp}.${nonce}.${raw}`).digest('hex');
    return { 'X-Signature': signature, 'X-Timestamp': String(timestamp), 'X-Nonce': nonce };
  }

  let extension8Id: string;
  let extension5Id: string;

  it('creates extensions for two units, returning the plaintext SIP password once', async () => {
    const created = await request(server())
      .post('/api/v1/telephony/extensions')
      .set(managerAuth())
      .set('Idempotency-Key', 'ext-key-8')
      .send({ unitId: unit8.id, number: '1008' });
    expect(created.status).toBe(201);
    expect(created.body.number).toBe('1008');
    expect(typeof created.body.sipPassword).toBe('string');
    expect(created.body.sipPassword.length).toBeGreaterThan(0);
    expect(created.body.sipPasswordEncrypted).toBeUndefined();
    extension8Id = created.body.id;

    const created5 = await request(server())
      .post('/api/v1/telephony/extensions')
      .set(managerAuth())
      .set('Idempotency-Key', 'ext-key-5')
      .send({ unitId: unit5.id, number: '1005' });
    expect(created5.status).toBe(201);
    extension5Id = created5.body.id;

    const list = await request(server())
      .get('/api/v1/telephony/extensions')
      .query({ condominiumId: condominium.id, page: 1, pageSize: 10 })
      .set(managerAuth());
    expect(list.status).toBe(200);
    expect(list.body.items).toHaveLength(2);
  });

  it('denies a role without TELEPHONY_OPERATE from creating an extension', async () => {
    const res = await request(server())
      .post('/api/v1/telephony/extensions')
      .set(clientAdminAuth())
      .set('Idempotency-Key', 'ext-key-denied')
      .send({ unitId: unit8.id, number: '1099' });
    expect(res.status).toBe(403);
  });

  let callAId: string;
  let callBId: string;

  it('runs the mandatory FIFO example: a second call to a busy extension queues, then promotes when the first ends', async () => {
    const callA = await request(server())
      .post('/api/v1/telephony/calls')
      .set(managerAuth())
      .set('Idempotency-Key', 'call-key-a')
      .send({ calleeExtensionId: extension8Id, triggeredBy: 'porteiro-1', externalCallId: `ext-call-a-${randomUUID()}` });
    expect(callA.status).toBe(201);
    expect(callA.body.status).toBe('RINGING');
    callAId = callA.body.id;

    const callB = await request(server())
      .post('/api/v1/telephony/calls')
      .set(managerAuth())
      .set('Idempotency-Key', 'call-key-b')
      .send({ calleeExtensionId: extension8Id, triggeredBy: 'porteiro-2', externalCallId: `ext-call-b-${randomUUID()}` });
    expect(callB.status).toBe(201);
    expect(callB.body.status).toBe('QUEUED');
    callBId = callB.body.id;

    const endBody = { type: 'CALL_ENDED', data: { externalCallId: callA.body.externalCallId, reason: 'COMPLETED' } };
    const ended = await request(server())
      .post('/api/v1/telephony/events')
      .set(signedWebhookHeaders(endBody))
      .send(endBody);
    expect(ended.status).toBe(201);
    expect(ended.body.callId).toBe(callAId);

    const list = await request(server())
      .get('/api/v1/telephony/calls')
      .query({ condominiumId: condominium.id, page: 1, pageSize: 10 })
      .set(managerAuth());
    const promoted = list.body.items.find((c: { id: string }) => c.id === callBId);
    expect(promoted.status).toBe('RINGING');
  });

  it('abandons and times out queued calls', async () => {
    const callC = await request(server())
      .post('/api/v1/telephony/calls')
      .set(managerAuth())
      .set('Idempotency-Key', 'call-key-c')
      .send({ calleeExtensionId: extension8Id, triggeredBy: 'porteiro-3', externalCallId: `ext-call-c-${randomUUID()}` });
    expect(callC.body.status).toBe('QUEUED');

    const abandoned = await request(server())
      .post(`/api/v1/telephony/calls/${callC.body.id}/abandon`)
      .set(managerAuth())
      .set('Idempotency-Key', 'call-key-c-abandon')
      .send();
    expect(abandoned.status).toBe(201);
    expect(abandoned.body.status).toBe('ABANDONED');

    const callD = await request(server())
      .post('/api/v1/telephony/calls')
      .set(managerAuth())
      .set('Idempotency-Key', 'call-key-d')
      .send({ calleeExtensionId: extension8Id, triggeredBy: 'porteiro-4', externalCallId: `ext-call-d-${randomUUID()}` });
    expect(callD.body.status).toBe('QUEUED');

    const timedOut = await request(server())
      .post(`/api/v1/telephony/calls/${callD.body.id}/timeout`)
      .set(managerAuth())
      .set('Idempotency-Key', 'call-key-d-timeout')
      .send();
    expect(timedOut.status).toBe(201);
    expect(timedOut.body.status).toBe('TIMEOUT');
  });

  it('denies a role without TELEPHONY_OPERATE from originating a call', async () => {
    const res = await request(server())
      .post('/api/v1/telephony/calls')
      .set(clientAdminAuth())
      .set('Idempotency-Key', 'call-key-denied')
      .send({ calleeExtensionId: extension5Id, triggeredBy: 'x', externalCallId: `ext-call-denied-${randomUUID()}` });
    expect(res.status).toBe(403);
  });

  it('processes a full CALL_STARTED -> CALL_ANSWERED -> CALL_ENDED webhook lifecycle, idempotently', async () => {
    const externalCallId = `ext-call-e-${randomUUID()}`;
    const startedBody = {
      type: 'CALL_STARTED',
      data: {
        externalCallId,
        condominiumId: condominium.id,
        caller: { type: 'GATEHOUSE' },
        callee: { type: 'EXTENSION', extensionId: extension5Id },
      },
    };
    const started = await request(server())
      .post('/api/v1/telephony/events')
      .set(signedWebhookHeaders(startedBody))
      .send(startedBody);
    expect(started.status).toBe(201);
    const callId = started.body.callId;

    const answeredBody = { type: 'CALL_ANSWERED', data: { externalCallId } };
    const answered = await request(server())
      .post('/api/v1/telephony/events')
      .set(signedWebhookHeaders(answeredBody))
      .send(answeredBody);
    expect(answered.status).toBe(201);

    const answeredReplay = await request(server())
      .post('/api/v1/telephony/events')
      .set(signedWebhookHeaders(answeredBody))
      .send(answeredBody);
    expect(answeredReplay.status).toBe(201);
    expect(answeredReplay.body.callId).toBe(callId);

    const endedBody = { type: 'CALL_ENDED', data: { externalCallId, reason: 'COMPLETED' } };
    const ended = await request(server())
      .post('/api/v1/telephony/events')
      .set(signedWebhookHeaders(endedBody))
      .send(endedBody);
    expect(ended.status).toBe(201);

    const endedReplay = await request(server())
      .post('/api/v1/telephony/events')
      .set(signedWebhookHeaders(endedBody))
      .send(endedBody);
    expect(endedReplay.status).toBe(201);
    expect(endedReplay.body.callId).toBe(callId);

    const recording = await request(server())
      .post('/api/v1/telephony/recordings')
      .set(managerAuth())
      .set('Idempotency-Key', 'recording-key-1')
      .send({ callId, storageKey: `recordings/${callId}.wav`, checksum: 'sha256:deadbeef', sizeBytes: 1000, durationSeconds: 30 });
    expect(recording.status).toBe(201);
    expect(recording.body.callId).toBe(callId);
  });

  it('rejects a webhook call with an invalid signature', async () => {
    const body = { type: 'CALL_ANSWERED', data: { externalCallId: 'does-not-matter' } };
    const headers = signedWebhookHeaders(body);
    const res = await request(server())
      .post('/api/v1/telephony/events')
      .set({ ...headers, 'X-Signature': 'a'.repeat(64) })
      .send(body);
    expect(res.status).toBe(403);
  });

  it('rejects a webhook call with a stale timestamp', async () => {
    const body = { type: 'CALL_ANSWERED', data: { externalCallId: 'does-not-matter' } };
    const staleTimestamp = Date.now() - 10 * 60 * 1000;
    const res = await request(server())
      .post('/api/v1/telephony/events')
      .set(signedWebhookHeaders(body, { timestamp: staleTimestamp }))
      .send(body);
    expect(res.status).toBe(403);
  });

  it('rejects a replayed nonce', async () => {
    const body = { type: 'CALL_ANSWERED', data: { externalCallId: 'nonce-replay-test' } };
    const headers = signedWebhookHeaders(body);

    const first = await request(server()).post('/api/v1/telephony/events').set(headers).send(body);
    expect(first.status).toBe(400); // unknown call, but signature/nonce accepted

    const replay = await request(server()).post('/api/v1/telephony/events').set(headers).send(body);
    expect(replay.status).toBe(403);
  });

  it('does not require a JWT for the webhook route', async () => {
    const body = { type: 'CALL_ANSWERED', data: { externalCallId: 'no-jwt-needed' } };
    const res = await request(server()).post('/api/v1/telephony/events').set(signedWebhookHeaders(body)).send(body);
    expect(res.status).not.toBe(401);
  });
});
