import { Module } from '@nestjs/common';
import { AuditService } from '../common/audit/audit.service';
import { IdempotencyInterceptor } from '../common/http/idempotency.interceptor';
import { VmsController } from './http/vms.controller';
import { VmsService } from './vms.service';

@Module({ controllers: [VmsController], providers: [VmsService, AuditService, IdempotencyInterceptor], exports: [VmsService] })
export class VmsModule {}
