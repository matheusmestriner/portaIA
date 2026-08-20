import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PasswordHasherService } from '../../auth/password-hasher.service';
import { ResidentTokenService } from '../resident-token.service';

export interface ResidentChangePasswordResult {
  accessToken: string;
  refreshToken: string;
}

/** Espelha ChangePasswordUseCase (equipe) — ver o comentário lá sobre por que uma sessão nova é emitida na hora, não um 204 vazio. */
@Injectable()
export class ResidentChangePasswordUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordHasher: PasswordHasherService,
    private readonly tokens: ResidentTokenService,
  ) {}

  async execute(residentId: string, currentPassword: string, newPassword: string): Promise<ResidentChangePasswordResult> {
    const resident = await this.prisma.resident.findUniqueOrThrow({ where: { id: residentId } });
    if (!resident.passwordHash) {
      throw new UnauthorizedException('Conta sem senha definida');
    }

    const currentValid = await this.passwordHasher.verify(currentPassword, resident.passwordHash);
    if (!currentValid) {
      throw new UnauthorizedException('Senha atual incorreta');
    }

    const sameAsCurrent = await this.passwordHasher.verify(newPassword, resident.passwordHash);
    if (sameAsCurrent) {
      throw new BadRequestException('A nova senha deve ser diferente da atual');
    }

    const newHash = await this.passwordHasher.hash(newPassword);
    const scope = { resaleId: resident.resaleId, clientId: resident.clientId, condominiumId: resident.condominiumId };
    const next = this.tokens.issueRefreshToken();

    await this.prisma.withTenantContext(scope, async (tx) => {
      await tx.resident.update({
        where: { id: residentId },
        data: {
          passwordHash: newHash,
          mustChangePassword: false,
          passwordChangedAt: new Date(),
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
      await tx.residentRefreshToken.updateMany({
        where: { residentId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.residentRefreshToken.create({
        data: {
          residentId,
          tokenHash: next.hash,
          expiresAt: next.expiresAt,
          resaleId: resident.resaleId,
          clientId: resident.clientId,
          condominiumId: resident.condominiumId,
        },
      });
    });

    const accessToken = this.tokens.signAccessTokenForResident(resident, { mustChangePassword: false });

    return { accessToken, refreshToken: next.plain };
  }
}
