import { Module } from '@nestjs/common';
import { PrivacyService } from './privacy.service';
import { AuditService } from '../common/audit/audit.service';
import { PrivacyController } from './http/privacy.controller';
import { IdempotencyInterceptor } from '../common/http/idempotency.interceptor';

@Module({
  controllers: [PrivacyController],
  providers: [PrivacyService, AuditService, IdempotencyInterceptor],
  exports: [PrivacyService],
})
export class PrivacyModule {}
