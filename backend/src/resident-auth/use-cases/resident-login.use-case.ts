import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PasswordHasherService } from '../../auth/password-hasher.service';
import { DUMMY_PASSWORD_HASH } from '../../auth/use-cases/login.use-case';
import { effectiveAttempts, isLocked, lockDurationMs, shouldLock } from '../../auth/login-throttle';
import { ResidentTokenService } from '../resident-token.service';

export interface ResidentLoginResult {
  residentId: string;
  mustChangePassword: boolean;
  accessToken: string;
  refreshToken: string;
}

/**
 * Espelha LoginUseCase (backend/src/auth/use-cases/login.use-case.ts) para o
 * ator Resident — mesmo desenho anti-enumeração/anti-timing-oracle
 * (DUMMY_PASSWORD_HASH reaproveitado, resposta de forma constante), mesmo
 * bloqueio progressivo por conta via SELECT...FOR UPDATE. Não roda
 * auditedOperation: o login de equipe também não audita tentativas hoje
 * (paridade deliberada, não descuido).
 */
@Injectable()
export class ResidentLoginUseCase {
  private readonly logger = new Logger(ResidentLoginUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordHasher: PasswordHasherService,
    private readonly tokens: ResidentTokenService,
  ) {}

  async execute(email: string, password: string): Promise<ResidentLoginResult> {
    // Assim como o login de equipe: roda sem escopo de tenant (nenhum tenant
    // é conhecido ainda), e email é a única coluna globalmente única de
    // Resident hoje.
    const resident = await this.prisma.resident.findUnique({ where: { email: email.toLowerCase().trim() } });

    const passwordHash = resident?.passwordHash ?? DUMMY_PASSWORD_HASH;
    const passwordValid = await this.passwordHasher.verify(password, passwordHash);

    if (resident && isLocked(resident.lockedUntil)) {
      this.logger.warn({ residentId: resident.id }, 'Tentativa de login em conta de morador bloqueada');
      throw new UnauthorizedException('Credenciais inválidas');
    }

    if (!resident || !resident.isActive || !resident.passwordHash || !passwordValid) {
      if (resident) await this.registerFailure(resident.id);
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const accessToken = this.tokens.signAccessTokenForResident(resident);
    const refresh = this.tokens.issueRefreshToken();

    const scope = { resaleId: resident.resaleId, clientId: resident.clientId, condominiumId: resident.condominiumId };
    await this.prisma.withTenantContext(scope, async (tx) => {
      await tx.residentRefreshToken.create({
        data: {
          residentId: resident.id,
          tokenHash: refresh.hash,
          expiresAt: refresh.expiresAt,
          resaleId: resident.resaleId,
          clientId: resident.clientId,
          condominiumId: resident.condominiumId,
        },
      });
      await tx.resident.update({
        where: { id: resident.id },
        data: { lastLoginAt: new Date(), failedLoginAttempts: 0, lockedUntil: null },
      });
    });

    return {
      residentId: resident.id,
      mustChangePassword: resident.mustChangePassword,
      accessToken,
      refreshToken: refresh.plain,
    };
  }

  private async registerFailure(residentId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ failedLoginAttempts: number; lastFailedLoginAt: Date | null }>>`
        SELECT failed_login_attempts AS "failedLoginAttempts", last_failed_login_at AS "lastFailedLoginAt"
        FROM residents WHERE id = ${residentId} FOR UPDATE
      `;
      const row = rows[0];
      if (!row) return;

      const attempts = effectiveAttempts(row.failedLoginAttempts, row.lastFailedLoginAt) + 1;
      const locked = shouldLock(attempts);

      await tx.resident.update({
        where: { id: residentId },
        data: {
          failedLoginAttempts: attempts,
          lastFailedLoginAt: new Date(),
          ...(locked ? { lockedUntil: new Date(Date.now() + lockDurationMs(attempts)) } : {}),
        },
      });

      if (locked) {
        this.logger.warn({ residentId, attempts }, 'Conta de morador bloqueada temporariamente por tentativas de login');
      }
    });
  }
}
