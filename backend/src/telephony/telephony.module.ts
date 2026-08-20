import { Module } from '@nestjs/common';
import { ExtensionsService } from './extensions.service';
import { CallsService } from './calls.service';
import { RecordingsService } from './recordings.service';
import { AuditService } from '../common/audit/audit.service';
import { ExtensionsController } from './http/extensions.controller';
import { CallsController } from './http/calls.controller';
import { RecordingsController } from './http/recordings.controller';
import { TelephonyEventsController } from './http/telephony-events.controller';
import { HmacWebhookGuard } from './http/hmac-webhook.guard';
import { IdempotencyInterceptor } from '../common/http/idempotency.interceptor';

@Module({
  controllers: [ExtensionsController, CallsController, RecordingsController, TelephonyEventsController],
  providers: [
    ExtensionsService,
    CallsService,
    RecordingsService,
    AuditService,
    HmacWebhookGuard,
    IdempotencyInterceptor,
  ],
  exports: [ExtensionsService, CallsService, RecordingsService],
})
export class TelephonyModule {}
