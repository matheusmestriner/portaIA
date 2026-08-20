import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RESIDENT_ALLOW_PASSWORD_CHANGE_PENDING_KEY } from './resident-allow-password-change-pending.decorator';
import type { ResidentAuthenticatedRequest } from './resident-jwt-auth.guard';

/** Espelha MustChangePasswordGuard (equipe) para o ator Resident. Aplicado explicitamente, não como APP_GUARD global. */
@Injectable()
export class ResidentMustChangePasswordGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const allowed = this.reflector.getAllAndOverride<boolean>(RESIDENT_ALLOW_PASSWORD_CHANGE_PENDING_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (allowed) {
      return true;
    }

    const request = context.switchToHttp().getRequest<ResidentAuthenticatedRequest>();
    if (request.residentActor?.mustChangePassword) {
      throw new ForbiddenException('Troca de senha obrigatória pendente');
    }
    return true;
  }
}
