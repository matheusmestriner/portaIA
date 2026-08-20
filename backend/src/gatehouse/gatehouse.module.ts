import { Module } from '@nestjs/common';
import { GatehouseService } from './gatehouse.service';
import { OperationalPhotosService } from './operational-photos.service';
import { DeliveryNotificationsService } from './delivery-notifications.service';
import { AuditService } from '../common/audit/audit.service';
import { WhatsAppAdapter } from '../notifications/adapters/whatsapp.adapter';
import { VisitorsController } from './http/visitors.controller';
import { DeliveriesController } from './http/deliveries.controller';
import { KeysController } from './http/keys.controller';
import { PhotosController } from './http/photos.controller';
import { IdempotencyInterceptor } from '../common/http/idempotency.interceptor';

@Module({
  controllers: [VisitorsController, DeliveriesController, KeysController, PhotosController],
  providers: [
    GatehouseService,
    OperationalPhotosService,
    DeliveryNotificationsService,
    WhatsAppAdapter,
    AuditService,
    IdempotencyInterceptor,
  ],
  exports: [GatehouseService, OperationalPhotosService],
})
export class GatehouseModule {}
