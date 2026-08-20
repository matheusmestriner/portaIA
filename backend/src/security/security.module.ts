import { Module } from '@nestjs/common';
import { SecurityService } from './security.service';
import { AuditService } from '../common/audit/audit.service';
import { OccurrencesController } from './http/occurrences.controller';
import { PanicAlertsController } from './http/panic-alerts.controller';
import { BlockListController } from './http/block-list.controller';
import { IdempotencyInterceptor } from '../common/http/idempotency.interceptor';

@Module({
  controllers: [OccurrencesController, PanicAlertsController, BlockListController],
  providers: [SecurityService, AuditService, IdempotencyInterceptor],
  exports: [SecurityService],
})
export class SecurityModule {}
