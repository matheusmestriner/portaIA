import { Module } from '@nestjs/common';
import { PlansService } from './plans.service';
import { AuditService } from '../common/audit/audit.service';
import { PlansController } from './http/plans.controller';
import { IdempotencyInterceptor } from '../common/http/idempotency.interceptor';

@Module({
  controllers: [PlansController],
  providers: [PlansService, AuditService, IdempotencyInterceptor],
  exports: [PlansService],
})
export class PlansModule {}
