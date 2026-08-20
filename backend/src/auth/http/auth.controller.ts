import { randomBytes } from 'crypto';
import { Body, Controller, Get, HttpCode, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { LoginUseCase } from '../use-cases/login.use-case';
import { RefreshTokensUseCase } from '../use-cases/refresh-tokens.use-case';
import { ChangePasswordUseCase } from '../use-cases/change-password.use-case';
import { PrismaService } from '../../prisma/prisma.service';
import { PublicRoute } from './public-route.decorator';
import { AllowPasswordChangePending } from './allow-password-change-pending.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CsrfGuard } from './csrf.guard';
import { CurrentActor } from './current-actor.decorator';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import { changePasswordBodySchema, loginBodySchema, type ChangePasswordBody, type LoginBody } from './dto';
import { CSRF_COOKIE_NAME, REFRESH_COOKIE_NAME } from './cookie-names';
import { toMeResponse } from './response.mappers';
import type { Actor } from '../actor';
import type { EnvConfig } from '../../config/env.schema';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly refreshUseCase: RefreshTokensUseCase,
    private readonly changePasswordUseCase: ChangePasswordUseCase,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  @PublicRoute()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Autentica com email/senha e inicia uma sessão (refresh cookie + CSRF cookie).' })
  async login(
    @Body(new ZodValidationPipe(loginBodySchema)) body: LoginBody,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.loginUseCase.execute(body.email, body.password);
    const csrfToken = randomBytes(24).toString('hex');
    this.setSessionCookies(res, result.refreshToken, csrfToken);
    return { accessToken: result.accessToken, mustChangePassword: result.mustChangePassword, csrfToken };
  }

  @PublicRoute()
  @UseGuards(CsrfGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rotaciona o refresh token (lido do cookie HttpOnly) e emite um novo access token.' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!refreshToken) {
      throw new UnauthorizedException('Sessão ausente');
    }
    const result = await this.refreshUseCase.execute(refreshToken);
    const csrfToken = randomBytes(24).toString('hex');
    this.setSessionCookies(res, result.refreshToken, csrfToken);
    return { accessToken: result.accessToken, csrfToken, mustChangePassword: result.mustChangePassword };
  }

  @UseGuards(JwtAuthGuard, CsrfGuard)
  @AllowPasswordChangePending()
  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'Revoga todas as sessões ativas do usuário e limpa os cookies.' })
  async logout(@CurrentActor() actor: Actor, @Res({ passthrough: true }) res: Response): Promise<void> {
    // Revoga por usuário, não só o token do cookie: se um refresh concorrente
    // já rotacionou o token em voo, o substituto também é alcançado, em vez
    // de sobreviver ativo depois que o cliente já mostrou "sessão encerrada".
    await this.prisma.refreshToken.updateMany({
      where: { userId: actor.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    res.clearCookie(REFRESH_COOKIE_NAME, this.cookieOptions());
    res.clearCookie(CSRF_COOKIE_NAME, { ...this.cookieOptions(), httpOnly: false });
  }

  @UseGuards(JwtAuthGuard)
  @AllowPasswordChangePending()
  @Post('change-password')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Troca a senha do usuário autenticado, revoga as sessões existentes e emite uma sessão nova — ' +
      'o access token anterior ainda carrega mustChangePassword=true e pararia de funcionar em qualquer outra rota.',
  })
  async changePassword(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(changePasswordBodySchema)) body: ChangePasswordBody,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.changePasswordUseCase.execute(actor.id, body.currentPassword, body.newPassword);
    const csrfToken = randomBytes(24).toString('hex');
    this.setSessionCookies(res, result.refreshToken, csrfToken);
    return { accessToken: result.accessToken, csrfToken };
  }

  @UseGuards(JwtAuthGuard)
  @AllowPasswordChangePending()
  @Get('me')
  @ApiOperation({ summary: 'Devolve os dados do próprio ator autenticado (equipe).' })
  async me(@CurrentActor() actor: Actor) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: actor.id } });
    return toMeResponse(user);
  }

  private setSessionCookies(res: Response, refreshToken: string, csrfToken: string): void {
    const ttlMs = this.config.get('JWT_REFRESH_TTL_SECONDS', { infer: true }) * 1000;
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, { ...this.cookieOptions(), maxAge: ttlMs });
    res.cookie(CSRF_COOKIE_NAME, csrfToken, { ...this.cookieOptions(), httpOnly: false, maxAge: ttlMs });
  }

  private cookieOptions() {
    const isProduction = this.config.get('NODE_ENV', { infer: true }) === 'production';
    return {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict' as const,
      path: '/api/v1/auth',
    };
  }
}
