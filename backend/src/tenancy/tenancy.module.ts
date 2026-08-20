import { Module } from '@nestjs/common';
import { TenancyService } from './tenancy.service';
import { AuditService } from '../common/audit/audit.service';
import { ResalesController } from './http/resales.controller';
import { ClientsController } from './http/clients.controller';
import { CondominiumsController } from './http/condominiums.controller';
import { IdempotencyInterceptor } from '../common/http/idempotency.interceptor';

@Module({
  controllers: [ResalesController, ClientsController, CondominiumsController],
  providers: [TenancyService, AuditService, IdempotencyInterceptor],
  exports: [TenancyService],
})
export class TenancyModule {}
