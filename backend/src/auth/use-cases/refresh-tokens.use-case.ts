import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TokenService } from '../token.service';
import { resolveTenantScope } from '../rbac/tenant-scope.resolver';

export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
  mustChangePassword: boolean;
}

@Injectable()
export class RefreshTokensUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  async execute(refreshTokenPlain: string): Promise<RefreshResult> {
    const hash = this.tokens.hashRefreshToken(refreshTokenPlain);

    // Looked up unscoped: the caller presents an opaque bearer token, not a
    // tenant context, and tokenHash is a unique, unguessable 384-bit value —
    // this is not a tenant-data read in the sense RLS is protecting against.
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hash },
      include: { user: true },
    });

    if (!existing) {
      throw new UnauthorizedException('Refresh token inválido ou expirado');
    }

    if (existing.revokedAt) {
      // Reuse of an already-rotated token signals theft: the legitimate
      // client already moved on to a newer token in this chain. Revoke
      // every other active token for this user defensively.
      await this.revokeAllActive(existing.userId);
      throw new UnauthorizedException('Refresh token inválido ou expirado');
    }

    if (existing.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Refresh token inválido ou expirado');
    }

    const { user } = existing;
    if (!user.isActive) {
      throw new UnauthorizedException('Usuário inativo');
    }

    const scope = resolveTenantScope(user);
    const next = this.tokens.issueRefreshToken();

    await this.prisma.withTenantContext(scope, async (tx) => {
      const created = await tx.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: next.hash,
          expiresAt: next.expiresAt,
          resaleId: user.resaleId,
          clientId: user.clientId,
          condominiumId: user.condominiumId,
        },
      });
      await tx.refreshToken.update({
        where: { id: existing.id },
        data: { revokedAt: new Date(), replacedById: created.id },
      });
    });

    const accessToken = this.tokens.signAccessTokenForUser(user);

    return { accessToken, refreshToken: next.plain, mustChangePassword: user.mustChangePassword };
  }

  private async revokeAllActive(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
