import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { TokenService } from '../token.service';
import { PUBLIC_ROUTE_KEY } from './public-route.decorator';
import type { Actor } from '../actor';

export interface AuthenticatedRequest extends Request {
  actor: Actor;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly tokens: TokenService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token de acesso ausente');
    }

    try {
      const claims = this.tokens.verifyAccessToken(header.slice('Bearer '.length));
      request.actor = {
        id: claims.sub,
        role: claims.role,
        resaleId: claims.resaleId,
        clientId: claims.clientId,
        condominiumId: claims.condominiumId,
        mustChangePassword: claims.mustChangePassword,
      };
      return true;
    } catch {
      throw new UnauthorizedException('Token de acesso inválido ou expirado');
    }
  }
}
