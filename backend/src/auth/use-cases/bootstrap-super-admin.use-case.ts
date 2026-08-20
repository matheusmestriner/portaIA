import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PasswordHasherService } from '../password-hasher.service';
import type { EnvConfig } from '../../config/env.schema';

/**
 * Idempotent: does nothing if a SUPER_ADMIN already exists. Reads the
 * bootstrap credentials from SUPER_ADMIN_BOOTSTRAP_EMAIL/PASSWORD, which
 * should only be set for the one run that provisions the first account.
 * The created user has mustChangePassword=true.
 */
@Injectable()
export class BootstrapSuperAdminUseCase {
  private readonly logger = new Logger(BootstrapSuperAdminUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordHasher: PasswordHasherService,
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  async execute(): Promise<{ created: boolean }> {
    const existing = await this.prisma.user.findFirst({ where: { role: UserRole.SUPER_ADMIN } });
    if (existing) {
      this.logger.log('Super admin já existe; bootstrap ignorado.');
      return { created: false };
    }

    const email = this.config.get('SUPER_ADMIN_BOOTSTRAP_EMAIL', { infer: true });
    const password = this.config.get('SUPER_ADMIN_BOOTSTRAP_PASSWORD', { infer: true });

    if (!email || !password) {
      throw new Error(
        'SUPER_ADMIN_BOOTSTRAP_EMAIL e SUPER_ADMIN_BOOTSTRAP_PASSWORD são obrigatórios para o bootstrap inicial.',
      );
    }

    const passwordHash = await this.passwordHasher.hash(password);

    await this.prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        passwordHash,
        role: UserRole.SUPER_ADMIN,
        mustChangePassword: true,
      },
    });

    this.logger.log(`Super admin inicial criado para ${email}. Troca de senha obrigatória no primeiro login.`);
    return { created: true };
  }
}
