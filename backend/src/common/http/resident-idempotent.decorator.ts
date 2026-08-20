import { UseInterceptors, applyDecorators } from '@nestjs/common';
import { SetMetadata } from '@nestjs/common';
import { IDEMPOTENT_ROUTE_KEY } from './idempotent.decorator';
import { ResidentIdempotencyInterceptor } from './resident-idempotency.interceptor';

/** Espelha @Idempotent() (equipe), mas usa ResidentIdempotencyInterceptor (lê request.residentActor, não request.actor). */
export const ResidentIdempotent = (routeName: string) =>
  applyDecorators(SetMetadata(IDEMPOTENT_ROUTE_KEY, routeName), UseInterceptors(ResidentIdempotencyInterceptor));
