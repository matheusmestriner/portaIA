import { Test, type TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PasswordHasherService } from '../src/auth/password-hasher.service';
import { LoginUseCase } from '../src/auth/use-cases/login.use-case';

/**
 * The account-lockout counter used to be a plain read-then-write
 * (findUnique, compute +1, update) — concurrent failed attempts for the
 * same account would all read the same starting value and each write back
 * the same "+1", losing every attempt but one. A distributed brute-force
 * script sends its guesses in parallel precisely to maximize throughput,
 * which is exactly the case that pattern failed on. This proves the fix
 * (SELECT ... FOR UPDATE inside a transaction) actually serializes it.
 */
describe('Login throttle counter under concurrency (integration)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let login: LoginUseCase;

  const email = 'concurrency-it@example.com';
  const correctPassword = 'a-strong-password-concurrency-1';

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    prisma = moduleRef.get(PrismaService);
    login = moduleRef.get(LoginUseCase);
    const hasher = moduleRef.get(PasswordHasherService);
    await prisma.$connect();

    await prisma.user.create({
      data: {
        email,
        passwordHash: await hasher.hash(correctPassword),
        role: UserRole.CLIENT_ADMIN,
        mustChangePassword: false,
      },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
    await moduleRef.close();
  });

  it('registers every concurrent failed attempt exactly once, with no lost updates', async () => {
    const CONCURRENT_ATTEMPTS = 8;

    const results = await Promise.allSettled(
      Array.from({ length: CONCURRENT_ATTEMPTS }, () => login.execute(email, 'definitely-wrong')),
    );
    expect(results.every((r) => r.status === 'rejected')).toBe(true);

    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    // MAX_FAILED_ATTEMPTS is 5, so 8 concurrent failures must lock the
    // account (proves the lock-triggering write itself isn't racy either).
    expect(user.failedLoginAttempts).toBe(CONCURRENT_ATTEMPTS);
    expect(user.lockedUntil).not.toBeNull();
    expect(user.lockedUntil!.getTime()).toBeGreaterThan(Date.now());

    // The account is now locked — even the correct password must be
    // rejected, with the same generic message (no lockout state leak).
    await expect(login.execute(email, correctPassword)).rejects.toThrow(UnauthorizedException);
  });
});
