import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from '../auth/auth.module';
import { ResidentTokenService } from './resident-token.service';
import { ResidentLoginUseCase } from './use-cases/resident-login.use-case';
import { ResidentRefreshTokensUseCase } from './use-cases/resident-refresh-tokens.use-case';
import { ResidentChangePasswordUseCase } from './use-cases/resident-change-password.use-case';
import { ResidentAuthController } from './http/resident-auth.controller';
import { ResidentJwtAuthGuard } from './http/resident-jwt-auth.guard';
import { ResidentMustChangePasswordGuard } from './http/resident-must-change-password.guard';

@Module({
  imports: [JwtModule.register({}), AuthModule],
  controllers: [ResidentAuthController],
  providers: [
    ResidentTokenService,
    ResidentLoginUseCase,
    ResidentRefreshTokensUseCase,
    ResidentChangePasswordUseCase,
    ResidentJwtAuthGuard,
    ResidentMustChangePasswordGuard,
  ],
  exports: [ResidentTokenService, ResidentJwtAuthGuard, ResidentMustChangePasswordGuard],
})
export class ResidentAuthModule {}
