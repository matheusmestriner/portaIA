import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PasswordHasherService } from '../password-hasher.service';
import { TokenService } from '../token.service';
import { resolveTenantScope } from '../rbac/tenant-scope.resolver';
import { effectiveAttempts, isLocked, lockDurationMs, shouldLock } from '../login-throttle';

export interface LoginResult {
  userId: string;
  mustChangePassword: boolean;
  accessToken: string;
  refreshToken: string;
}

/**
 * A valid bcrypt hash (exactly 60 chars, cost 12 — same as
 * PasswordHasherService's SALT_ROUNDS) of an arbitrary fixed string, used to
 * pay bcrypt's real cost when the email doesn't exist. bcryptjs.compare()
 * short-circuits to `false` in ~0.1ms for ANY hash whose length isn't
 * exactly 60 (node_modules/bcryptjs/src/bcrypt.js: `if (hash.length !== 60)
 * return false` before touching the expensive path) — a hash that's off by
 * even one character silently turns this into the exact timing oracle it
 * exists to prevent (~250ms vs <1ms, trivially distinguishable in a single
 * request). Never hand-edit this string; regenerate with
 * bcrypt.hashSync(anything, 12) if it ever needs to change, and see the
 * length-is-60 test guarding against exactly this regression.
 */
export const DUMMY_PASSWORD_HASH = '$2a$12$ORtKhf0uhrlbN2PWOHr3A.ecgKBF5UcUcKI0mLDiATX048RX/t/U6';

@Injectable()
export class LoginUseCase {
  private readonly logger = new Logger(LoginUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordHasher: PasswordHasherService,
    private readonly tokens: TokenService,
  ) {}

  async execute(email: string, password: string): Promise<LoginResult> {
    // Login itself runs unscoped (no tenant is known yet) — email is
    // globally unique, so this is the one place that legitimately reads
    // across the whole `users` table.
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });

    // Constant-shape response whether the email exists or not, to avoid
    // leaking account existence via timing/branching. A senha é sempre
    // verificada, mesmo para email inexistente, para que o custo do bcrypt
    // não denuncie a diferença.
    const passwordHash = user?.passwordHash ?? DUMMY_PASSWORD_HASH;
    const passwordValid = await this.passwordHasher.verify(password, passwordHash);

    // A conta bloqueada devolve exatamente a mesma resposta de credencial
    // inválida: dizer "sua conta está bloqueada" confirmaria ao atacante que
    // o email existe e que ele acertou o alvo.
    if (user && isLocked(user.lockedUntil)) {
      this.logger.warn({ userId: user.id }, 'Tentativa de login em conta bloqueada');
      throw new UnauthorizedException('Credenciais inválidas');
    }

    if (!user || !user.isActive || !passwordValid) {
      if (user) await this.registerFailure(user.id);
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const scope = resolveTenantScope(user);
    const accessToken = this.tokens.signAccessTokenForUser(user);
    const refresh = this.tokens.issueRefreshToken();

    await this.prisma.withTenantContext(scope, async (tx) => {
      await tx.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: refresh.hash,
          expiresAt: refresh.expiresAt,
          resaleId: user.resaleId,
          clientId: user.clientId,
          condominiumId: user.condominiumId,
        },
      });
      await tx.user.update({
        where: { id: user.id },
        // Sucesso zera o contador: tentativas erradas antes de um acerto não
        // devem punir o usuário legítimo mais tarde.
        data: { lastLoginAt: new Date(), failedLoginAttempts: 0, lockedUntil: null },
      });
    });

    return {
      userId: user.id,
      mustChangePassword: user.mustChangePassword,
      accessToken,
      refreshToken: refresh.plain,
    };
  }

  /**
   * Contabiliza a falha e aplica o bloqueio quando o limite é atingido.
   * Roda sem escopo de tenant de propósito: ninguém está autenticado ainda, e
   * é uma escrita restrita às colunas de controle da própria linha do usuário.
   *
   * SELECT ... FOR UPDATE dentro de uma transação, não um simples
   * read-then-write: sem o lock de linha, tentativas de login concorrentes
   * para a mesma conta (exatamente o que um atacante de força bruta com
   * paralelismo faz) leem o mesmo failedLoginAttempts de partida e cada uma
   * escreve o mesmo "+1" — um "lost update" clássico. Com 20 requisições
   * simultâneas isso registraria só 1 tentativa em vez de 20, esvaziando o
   * bloqueio progressivo bem no cenário que ele existe para conter.
   */
  private async registerFailure(userId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ failedLoginAttempts: number; lastFailedLoginAt: Date | null }>>`
        SELECT failed_login_attempts AS "failedLoginAttempts", last_failed_login_at AS "lastFailedLoginAt"
        FROM users WHERE id = ${userId} FOR UPDATE
      `;
      const row = rows[0];
      if (!row) return;

      const attempts = effectiveAttempts(row.failedLoginAttempts, row.lastFailedLoginAt) + 1;
      const locked = shouldLock(attempts);

      await tx.user.update({
        where: { id: userId },
        data: {
          failedLoginAttempts: attempts,
          lastFailedLoginAt: new Date(),
          ...(locked ? { lockedUntil: new Date(Date.now() + lockDurationMs(attempts)) } : {}),
        },
      });

      if (locked) {
        this.logger.warn({ userId, attempts }, 'Conta bloqueada temporariamente por tentativas de login');
      }
    });
  }
}
