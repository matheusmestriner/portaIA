import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ResidentLoginUseCase } from '../use-cases/resident-login.use-case';
import { ResidentRefreshTokensUseCase } from '../use-cases/resident-refresh-tokens.use-case';
import { ResidentChangePasswordUseCase } from '../use-cases/resident-change-password.use-case';
import { PrismaService } from '../../prisma/prisma.service';
import { PublicRoute } from '../../auth/http/public-route.decorator';
import { ResidentJwtAuthGuard } from './resident-jwt-auth.guard';
import { ResidentAllowPasswordChangePending } from './resident-allow-password-change-pending.decorator';
import { CurrentResident } from './current-resident.decorator';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import {
  residentChangePasswordBodySchema,
  residentLoginBodySchema,
  residentRefreshBodySchema,
  type ResidentChangePasswordBody,
  type ResidentLoginBody,
  type ResidentRefreshBody,
} from './dto';
import type { ResidentActor } from '../resident-actor';

/**
 * Superfície de auth do app do morador — deliberadamente separada de
 * AuthController (equipe). @PublicRoute() em todas as rotas porque o
 * JwtAuthGuard de EQUIPE está registrado como APP_GUARD global (aplica a
 * toda rota da aplicação); sem isso, essas rotas exigiriam incorretamente um
 * bearer token de equipe antes mesmo de chegar aqui. A proteção real das
 * rotas autenticadas vem de ResidentJwtAuthGuard, aplicado explicitamente.
 *
 * Sem cookie/CSRF (ao contrário do fluxo de equipe): o cliente é um app
 * nativo, não um navegador — o refresh token vai no corpo da requisição, e o
 * app guarda em Keychain/Keystore.
 */
@ApiTags('resident-auth')
@Controller('resident-auth')
@PublicRoute()
export class ResidentAuthController {
  constructor(
    private readonly loginUseCase: ResidentLoginUseCase,
    private readonly refreshUseCase: ResidentRefreshTokensUseCase,
    private readonly changePasswordUseCase: ResidentChangePasswordUseCase,
    private readonly prisma: PrismaService,
  ) {}

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Autentica um morador com email/senha (app mobile).' })
  async login(@Body(new ZodValidationPipe(residentLoginBodySchema)) body: ResidentLoginBody) {
    const result = await this.loginUseCase.execute(body.email, body.password);
    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      mustChangePassword: result.mustChangePassword,
    };
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rotaciona o refresh token (enviado no corpo, não em cookie) e emite um novo access token.' })
  async refresh(@Body(new ZodValidationPipe(residentRefreshBodySchema)) body: ResidentRefreshBody) {
    const result = await this.refreshUseCase.execute(body.refreshToken);
    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      mustChangePassword: result.mustChangePassword,
    };
  }

  @UseGuards(ResidentJwtAuthGuard)
  @ResidentAllowPasswordChangePending()
  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'Revoga todas as sessões (refresh tokens) ativas do morador.' })
  async logout(@CurrentResident() resident: ResidentActor): Promise<void> {
    await this.prisma.residentRefreshToken.updateMany({
      where: { residentId: resident.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  @UseGuards(ResidentJwtAuthGuard)
  @ResidentAllowPasswordChangePending()
  @Post('change-password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Troca a senha do morador autenticado e emite uma sessão nova.' })
  async changePassword(
    @CurrentResident() resident: ResidentActor,
    @Body(new ZodValidationPipe(residentChangePasswordBodySchema)) body: ResidentChangePasswordBody,
  ) {
    const result = await this.changePasswordUseCase.execute(resident.id, body.currentPassword, body.newPassword);
    return { accessToken: result.accessToken, refreshToken: result.refreshToken };
  }
}
