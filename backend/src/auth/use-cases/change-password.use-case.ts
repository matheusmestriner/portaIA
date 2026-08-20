import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PasswordHasherService } from '../password-hasher.service';
import { TokenService } from '../token.service';
import { resolveTenantScope } from '../rbac/tenant-scope.resolver';

export interface ChangePasswordResult {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class ChangePasswordUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordHasher: PasswordHasherService,
    private readonly tokens: TokenService,
  ) {}

  async execute(userId: string, currentPassword: string, newPassword: string): Promise<ChangePasswordResult> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    const currentValid = await this.passwordHasher.verify(currentPassword, user.passwordHash);
    if (!currentValid) {
      throw new UnauthorizedException('Senha atual incorreta');
    }

    // Trocar por uma senha idêntica não é troca: bloquear evita que o fluxo
    // de "troca obrigatória no primeiro acesso" seja contornado repetindo a
    // senha temporária que o administrador já conhece.
    const sameAsCurrent = await this.passwordHasher.verify(newPassword, user.passwordHash);
    if (sameAsCurrent) {
      throw new BadRequestException('A nova senha deve ser diferente da atual');
    }

    const newHash = await this.passwordHasher.hash(newPassword);
    const scope = resolveTenantScope(user);
    const next = this.tokens.issueRefreshToken();

    await this.prisma.withTenantContext(scope, async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          passwordHash: newHash,
          mustChangePassword: false,
          passwordChangedAt: new Date(),
          // Uma troca bem-sucedida de senha limpa qualquer bloqueio pendente.
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
      // Force re-authentication everywhere after a password change.
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      // Issue the caller a fresh session in the same breath: their current
      // access token still carries mustChangePassword=true in its signed
      // claims (JWTs don't update retroactively) and MustChangePasswordGuard
      // would keep rejecting every other route with it — without a new
      // token here, the very next request after a successful change 403s.
      await tx.refreshToken.create({
        data: {
          userId,
          tokenHash: next.hash,
          expiresAt: next.expiresAt,
          resaleId: user.resaleId,
          clientId: user.clientId,
          condominiumId: user.condominiumId,
        },
      });
    });

    const accessToken = this.tokens.signAccessTokenForUser(user, { mustChangePassword: false });

    return { accessToken, refreshToken: next.plain };
  }
}
