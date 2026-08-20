import { BadRequestException, CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Request, Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { IDEMPOTENT_ROUTE_KEY } from './idempotent.decorator';
import type { AuthenticatedRequest } from '../../auth/http/jwt-auth.guard';

/**
 * Replays the stored response for a previously-seen Idempotency-Key on the
 * same route + actor, instead of re-running the handler. Required on every
 * endpoint decorated with @Idempotent() — a request without the header is
 * rejected rather than silently allowed to double-execute.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const routeName = this.reflector.get<string | undefined>(IDEMPOTENT_ROUTE_KEY, context.getHandler());
    if (!routeName) {
      return next.handle();
    }

    const http = context.switchToHttp();
    const request = http.getRequest<AuthenticatedRequest & Request>();
    const response = http.getResponse<Response>();

    const key = request.headers['idempotency-key'];
    if (!key || Array.isArray(key)) {
      throw new BadRequestException('Header Idempotency-Key é obrigatório para esta operação');
    }

    const existing = await this.prisma.idempotencyKey.findUnique({
      where: { key_route_actorUserId: { key, route: routeName, actorUserId: request.actor.id } },
    });
    if (existing) {
      response.status(existing.responseStatus);
      return of(existing.responseBody);
    }

    return next.handle().pipe(
      tap({
        next: async (body) => {
          try {
            await this.prisma.idempotencyKey.create({
              data: {
                key,
                route: routeName,
                actorUserId: request.actor.id,
                responseStatus: response.statusCode,
                responseBody: body as object,
              },
            });
          } catch {
            // Unique constraint race: a concurrent identical request already
            // stored its response first. Not this response's problem to
            // surface — the client will see one of the two equivalent
            // successful bodies, which is the whole point of idempotency.
          }
        },
        error: () => {
          // Failed attempts are not cached: the client should be able to
          // retry with the same key after fixing a transient failure.
        },
      }),
    );
  }
}
