import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PasswordHasherService } from './password-hasher.service';
import { TokenService } from './token.service';
import { LoginUseCase } from './use-cases/login.use-case';
import { RefreshTokensUseCase } from './use-cases/refresh-tokens.use-case';
import { ChangePasswordUseCase } from './use-cases/change-password.use-case';
import { BootstrapSuperAdminUseCase } from './use-cases/bootstrap-super-admin.use-case';
import { AuthController } from './http/auth.controller';
import { JwtAuthGuard } from './http/jwt-auth.guard';
import { PermissionsGuard } from './http/permissions.guard';
import { MustChangePasswordGuard } from './http/must-change-password.guard';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    PasswordHasherService,
    TokenService,
    LoginUseCase,
    RefreshTokensUseCase,
    ChangePasswordUseCase,
    BootstrapSuperAdminUseCase,
    JwtAuthGuard,
    PermissionsGuard,
    MustChangePasswordGuard,
  ],
  exports: [
    PasswordHasherService,
    TokenService,
    LoginUseCase,
    RefreshTokensUseCase,
    ChangePasswordUseCase,
    BootstrapSuperAdminUseCase,
    JwtAuthGuard,
    PermissionsGuard,
    MustChangePasswordGuard,
  ],
})
export class AuthModule {}
