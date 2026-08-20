import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { AuditService } from '../common/audit/audit.service';
import { WhatsAppAdapter } from './adapters/whatsapp.adapter';
import { NotificationsController } from './http/notifications.controller';
import { IdempotencyInterceptor } from '../common/http/idempotency.interceptor';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, AuditService, WhatsAppAdapter, IdempotencyInterceptor],
  exports: [NotificationsService],
})
export class NotificationsModule {}
