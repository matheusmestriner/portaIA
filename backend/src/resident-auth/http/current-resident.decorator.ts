import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { ResidentAuthenticatedRequest } from './resident-jwt-auth.guard';

export const CurrentResident = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<ResidentAuthenticatedRequest>();
  return request.residentActor;
});
