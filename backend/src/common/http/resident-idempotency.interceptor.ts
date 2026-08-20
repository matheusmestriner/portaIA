import { BadRequestException, CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Request, Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { IDEMPOTENT_ROUTE_KEY } from './idempotent.decorator';
import type { ResidentAuthenticatedRequest } from '../../resident-auth/http/resident-jwt-auth.guard';

/**
 * Espelha IdempotencyInterceptor (equipe), mas lê request.residentActor —
 * o ator de equipe fica em request.actor, o de morador em request.residentActor
 * (populados por guards diferentes). Reaproveitar o interceptor de equipe
 * direto quebraria aqui: request.actor é undefined numa rota de morador
 * (JwtAuthGuard de equipe nunca roda, a rota é @PublicRoute() para ele).
 */
@Injectable()
export class ResidentIdempotencyInterceptor implements NestInterceptor {
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
    const request = http.getRequest<ResidentAuthenticatedRequest & Request>();
    const response = http.getResponse<Response>();

    const key = request.headers['idempotency-key'];
    if (!key || Array.isArray(key)) {
      throw new BadRequestException('Header Idempotency-Key é obrigatório para esta operação');
    }

    const existing = await this.prisma.idempotencyKey.findUnique({
      where: { key_route_actorUserId: { key, route: routeName, actorUserId: request.residentActor.id } },
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
                actorUserId: request.residentActor.id,
                responseStatus: response.statusCode,
                responseBody: body as object,
              },
            });
          } catch {
            // Corrida de constraint única: uma requisição concorrente idêntica
            // já gravou a resposta primeiro — não é problema desta resposta.
          }
        },
        error: () => {
          // Tentativas com falha não são cacheadas: o cliente pode tentar de
          // novo com a mesma chave depois de corrigir uma falha transitória.
        },
      }),
    );
  }
}
