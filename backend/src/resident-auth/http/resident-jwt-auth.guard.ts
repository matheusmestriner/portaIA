import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { ResidentTokenService } from '../resident-token.service';
import type { ResidentActor } from '../resident-actor';

export interface ResidentAuthenticatedRequest extends Request {
  residentActor: ResidentActor;
}

/**
 * Análogo ao JwtAuthGuard de equipe, mas para o ator Resident — aplicado
 * explicitamente via @UseGuards nos controllers de backend/src/resident/**,
 * nunca registrado no APP_GUARD global (o guard chain global de
 * app.module.ts continua só sobre o ator de equipe).
 */
@Injectable()
export class ResidentJwtAuthGuard implements CanActivate {
  constructor(private readonly tokens: ResidentTokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<ResidentAuthenticatedRequest>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token de acesso ausente');
    }

    try {
      const claims = this.tokens.verifyAccessToken(header.slice('Bearer '.length));
      request.residentActor = {
        id: claims.sub,
        unitId: claims.unitId,
        condominiumId: claims.condominiumId,
        clientId: claims.clientId,
        resaleId: claims.resaleId,
        mustChangePassword: claims.mustChangePassword,
      };
      return true;
    } catch {
      throw new UnauthorizedException('Token de acesso inválido ou expirado');
    }
  }
}
