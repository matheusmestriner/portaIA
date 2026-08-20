import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { roleHasPermission, type Permission } from '../rbac/permissions';
import { REQUIRED_PERMISSION_KEY } from './require-permission.decorator';
import type { AuthenticatedRequest } from './jwt-auth.guard';

/** Runs after JwtAuthGuard has populated request.actor. */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission | undefined>(REQUIRED_PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.actor || !roleHasPermission(request.actor.role, required)) {
      throw new ForbiddenException(`Papel sem a permissão exigida: ${required}`);
    }
    return true;
  }
}
