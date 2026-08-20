import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ResidentTokenService } from '../resident-token.service';

export interface ResidentRefreshResult {
  accessToken: string;
  refreshToken: string;
  mustChangePassword: boolean;
}

/**
 * Espelha RefreshTokensUseCase (equipe), mas o token chega no CORPO da
 * requisição, não em cookie — o app nativo guarda em Keychain/Keystore e
 * reapresenta explicitamente (ver resident-auth.controller.ts). Mesma
 * rotação + revogação-em-reuso (theft detection) do fluxo de equipe.
 */
@Injectable()
export class ResidentRefreshTokensUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: ResidentTokenService,
  ) {}

  async execute(refreshTokenPlain: string): Promise<ResidentRefreshResult> {
    const hash = this.tokens.hashRefreshToken(refreshTokenPlain);

    const existing = await this.prisma.residentRefreshToken.findUnique({
      where: { tokenHash: hash },
      include: { resident: true },
    });

    if (!existing) {
      throw new UnauthorizedException('Refresh token inválido ou expirado');
    }

    if (existing.revokedAt) {
      await this.revokeAllActive(existing.residentId);
      throw new UnauthorizedException('Refresh token inválido ou expirado');
    }

    if (existing.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Refresh token inválido ou expirado');
    }

    const { resident } = existing;
    if (!resident.isActive) {
      throw new UnauthorizedException('Morador inativo');
    }

    const scope = { resaleId: resident.resaleId, clientId: resident.clientId, condominiumId: resident.condominiumId };
    const next = this.tokens.issueRefreshToken();

    await this.prisma.withTenantContext(scope, async (tx) => {
      const created = await tx.residentRefreshToken.create({
        data: {
          residentId: resident.id,
          tokenHash: next.hash,
          expiresAt: next.expiresAt,
          resaleId: resident.resaleId,
          clientId: resident.clientId,
          condominiumId: resident.condominiumId,
        },
      });
      await tx.residentRefreshToken.update({
        where: { id: existing.id },
        data: { revokedAt: new Date(), replacedById: created.id },
      });
    });

    const accessToken = this.tokens.signAccessTokenForResident(resident);

    return { accessToken, refreshToken: next.plain, mustChangePassword: resident.mustChangePassword };
  }

  private async revokeAllActive(residentId: string): Promise<void> {
    await this.prisma.residentRefreshToken.updateMany({
      where: { residentId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
