import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { CSRF_COOKIE_NAME } from './cookie-names';

/**
 * Double-submit cookie CSRF check. Only endpoints that authenticate via a
 * browser-attached cookie (refresh, logout) need this — every other
 * endpoint reads its credential from the Authorization header, which
 * browsers never attach automatically, so it isn't CSRF-exploitable.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const cookieToken = request.cookies?.[CSRF_COOKIE_NAME];
    const headerToken = request.headers['x-csrf-token'];

    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      throw new ForbiddenException('Token CSRF ausente ou inválido');
    }
    return true;
  }
}
