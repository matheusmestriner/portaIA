import { Test, type TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { BootstrapSuperAdminUseCase } from '../src/auth/use-cases/bootstrap-super-admin.use-case';
import { LoginUseCase } from '../src/auth/use-cases/login.use-case';
import { RefreshTokensUseCase } from '../src/auth/use-cases/refresh-tokens.use-case';
import { ChangePasswordUseCase } from '../src/auth/use-cases/change-password.use-case';
import { TokenService } from '../src/auth/token.service';

/**
 * Exercises the real auth wiring (Nest DI, Prisma, RLS) end to end against
 * a live PostgreSQL instance. Requires DATABASE_URL and APP_DATABASE_URL,
 * migrations applied, and SUPER_ADMIN_BOOTSTRAP_EMAIL/PASSWORD set.
 */
describe('Auth flow (integration)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;

  const bootstrapEmail = (process.env.SUPER_ADMIN_BOOTSTRAP_EMAIL ?? 'admin@example.com').toLowerCase();
  const bootstrapPassword = process.env.SUPER_ADMIN_BOOTSTRAP_PASSWORD ?? 'a-strong-password-123';

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();

    // BootstrapSuperAdminUseCase procura por QUALQUER SUPER_ADMIN, não pelo
    // email do bootstrap — então "created: true" só é verdade num banco sem
    // nenhum super admin. Outros arquivos de teste (platform-admin-http,
    // users-http, tenancy-http) criam super admins próprios, e um
    // `npm run bootstrap:super-admin` rodado à mão no banco de dev deixa um
    // permanente. Sem esta limpeza, este arquivo falha de forma
    // aparentemente aleatória dependendo do que rodou antes — garantir a
    // pré-condição explicitamente é mais honesto do que presumi-la.
    await prisma.refreshToken.deleteMany({ where: { user: { role: UserRole.SUPER_ADMIN } } });
    await prisma.user.deleteMany({ where: { role: UserRole.SUPER_ADMIN } });
  });

  afterAll(async () => {
    await prisma.refreshToken.deleteMany({ where: { user: { email: bootstrapEmail } } });
    await prisma.user.deleteMany({ where: { email: bootstrapEmail } });
    await prisma.$disconnect();
    await moduleRef.close();
  });

  it('bootstrap creates exactly one super admin and is idempotent on retry', async () => {
    const useCase = moduleRef.get(BootstrapSuperAdminUseCase);

    const first = await useCase.execute();
    const second = await useCase.execute();

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);

    const admins = await prisma.user.findMany({ where: { role: UserRole.SUPER_ADMIN } });
    const bootstrapped = admins.filter((a) => a.email === bootstrapEmail);
    expect(bootstrapped).toHaveLength(1);
    // Checa a linha do bootstrap explicitamente, não `admins[0]`: sem
    // orderBy, a primeira linha é arbitrária, e qualquer outro super admin
    // que sobrasse no banco faria esta asserção testar a conta errada.
    expect(bootstrapped[0].mustChangePassword).toBe(true);
  });

  it('logs in with the bootstrap credentials and rejects the wrong password', async () => {
    const login = moduleRef.get(LoginUseCase);

    await expect(login.execute(bootstrapEmail, 'definitely-wrong')).rejects.toThrow(UnauthorizedException);

    const result = await login.execute(bootstrapEmail, bootstrapPassword);
    expect(result.mustChangePassword).toBe(true);
    expect(result.accessToken).toEqual(expect.any(String));
    expect(result.refreshToken).toEqual(expect.any(String));

    const tokens = moduleRef.get(TokenService);
    const claims = tokens.verifyAccessToken(result.accessToken);
    expect(claims.role).toBe(UserRole.SUPER_ADMIN);
  });

  it('rotates the refresh token and blocks the old one from being used twice', async () => {
    const login = moduleRef.get(LoginUseCase);
    const refresh = moduleRef.get(RefreshTokensUseCase);

    const { refreshToken: firstToken } = await login.execute(bootstrapEmail, bootstrapPassword);

    const rotated = await refresh.execute(firstToken);
    expect(rotated.refreshToken).not.toBe(firstToken);

    // Reusing the already-rotated token must fail...
    await expect(refresh.execute(firstToken)).rejects.toThrow(UnauthorizedException);
    // ...and reuse detection revokes the chain, so even the freshly-rotated
    // token that followed it stops working.
    await expect(refresh.execute(rotated.refreshToken)).rejects.toThrow(UnauthorizedException);
  });

  it('changes the password, clears mustChangePassword, and revokes existing sessions', async () => {
    const login = moduleRef.get(LoginUseCase);
    const changePassword = moduleRef.get(ChangePasswordUseCase);
    const refresh = moduleRef.get(RefreshTokensUseCase);

    const { refreshToken, userId } = await login.execute(bootstrapEmail, bootstrapPassword);

    const newPassword = 'a-new-strong-password-456';
    await changePassword.execute(userId, bootstrapPassword, newPassword);

    const updated = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(updated.mustChangePassword).toBe(false);

    // The session that existed before the password change is revoked.
    await expect(refresh.execute(refreshToken)).rejects.toThrow(UnauthorizedException);

    // Old password no longer works; new one does.
    await expect(login.execute(bootstrapEmail, bootstrapPassword)).rejects.toThrow(UnauthorizedException);
    await expect(login.execute(bootstrapEmail, newPassword)).resolves.toBeDefined();

    // Restore the original password so the suite is re-runnable.
    const relogin = await login.execute(bootstrapEmail, newPassword);
    await changePassword.execute(relogin.userId, newPassword, bootstrapPassword);
  });
});
