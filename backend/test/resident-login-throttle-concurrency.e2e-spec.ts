import { Test, type TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PasswordHasherService } from '../src/auth/password-hasher.service';
import { ResidentLoginUseCase } from '../src/resident-auth/use-cases/resident-login.use-case';

/**
 * Espelha login-throttle-concurrency.e2e-spec.ts (equipe) para o ator
 * Resident — mesma correção de lost-update (SELECT...FOR UPDATE), mesma
 * asserção de que o bloqueio dispara sob tentativas concorrentes.
 */
describe('Resident login throttle counter under concurrency (integration)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let login: ResidentLoginUseCase;

  let resale: { id: string };
  let client: { id: string };
  let condominium: { id: string };
  let unit: { id: string };

  const email = 'resident-concurrency-it@example.com';
  const correctPassword = 'a-strong-password-concurrency-1';

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    prisma = moduleRef.get(PrismaService);
    login = moduleRef.get(ResidentLoginUseCase);
    const hasher = moduleRef.get(PasswordHasherService);
    await prisma.$connect();

    resale = await prisma.resale.create({ data: { name: 'Revenda Resident Concurrency', slug: 'revenda-resident-concurrency-it' } });
    client = await prisma.client.create({
      data: { name: 'Cliente Resident Concurrency', slug: 'cliente-resident-concurrency-it', resaleId: resale.id },
    });
    condominium = await prisma.condominium.create({
      data: { name: 'Condo Resident Concurrency', slug: 'condo-resident-concurrency-it', clientId: client.id, resaleId: resale.id },
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
        name: 'Ana Concorrência',
        email,
        passwordHash: await hasher.hash(correctPassword),
        mustChangePassword: false,
      },
    });
  });

  afterAll(async () => {
    await prisma.residentRefreshToken.deleteMany({ where: { resident: { email } } });
    await prisma.resident.deleteMany({ where: { email } });
    await prisma.unit.deleteMany({ where: { id: unit.id } });
    await prisma.condominium.deleteMany({ where: { id: condominium.id } });
    await prisma.client.deleteMany({ where: { id: client.id } });
    await prisma.resale.deleteMany({ where: { id: resale.id } });
    await prisma.$disconnect();
    await moduleRef.close();
  });

  it('registers every concurrent failed attempt exactly once, with no lost updates', async () => {
    const CONCURRENT_ATTEMPTS = 8;

    const results = await Promise.allSettled(
      Array.from({ length: CONCURRENT_ATTEMPTS }, () => login.execute(email, 'definitely-wrong')),
    );
    expect(results.every((r) => r.status === 'rejected')).toBe(true);

    const resident = await prisma.resident.findUniqueOrThrow({ where: { email } });
    expect(resident.failedLoginAttempts).toBe(CONCURRENT_ATTEMPTS);
    expect(resident.lockedUntil).not.toBeNull();
    expect(resident.lockedUntil!.getTime()).toBeGreaterThan(Date.now());

    await expect(login.execute(email, correctPassword)).rejects.toThrow(UnauthorizedException);
  });
});
