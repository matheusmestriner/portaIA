import { SetMetadata, UseInterceptors, applyDecorators } from '@nestjs/common';
import { IdempotencyInterceptor } from './idempotency.interceptor';

export const IDEMPOTENT_ROUTE_KEY = 'idempotentRoute';

/** Requires an Idempotency-Key header and replays the cached response for a repeated (key, route, actor) triple. */
export const Idempotent = (routeName: string) =>
  applyDecorators(SetMetadata(IDEMPOTENT_ROUTE_KEY, routeName), UseInterceptors(IdempotencyInterceptor));
