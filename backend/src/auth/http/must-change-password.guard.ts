import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ALLOW_PASSWORD_CHANGE_PENDING_KEY } from './allow-password-change-pending.decorator';
import type { AuthenticatedRequest } from './jwt-auth.guard';

/**
 * Runs after JwtAuthGuard has populated request.actor. A token minted while
 * the user still has a mandatory password change pending must not authorize
 * anything beyond completing that change (or logging out) — otherwise the
 * gate is purely cosmetic on the client, and the temporary password (shared
 * over an insecure channel by an admin) stays a full credential forever.
 */
@Injectable()
export class MustChangePasswordGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const allowed = this.reflector.getAllAndOverride<boolean>(ALLOW_PASSWORD_CHANGE_PENDING_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (allowed) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (request.actor?.mustChangePassword) {
      throw new ForbiddenException('Troca de senha obrigatória pendente');
    }
    return true;
  }
}
