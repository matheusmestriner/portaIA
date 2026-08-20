import { Module } from '@nestjs/common';
import { CondominialService } from './condominial.service';
import { AuditService } from '../common/audit/audit.service';
import { AuthModule } from '../auth/auth.module';
import { UnitsController } from './http/units.controller';
import { ResidentsController } from './http/residents.controller';
import { VehiclesController } from './http/vehicles.controller';
import { ProvidersController } from './http/providers.controller';
import { IdempotencyInterceptor } from '../common/http/idempotency.interceptor';

@Module({
  imports: [AuthModule],
  controllers: [UnitsController, ResidentsController, VehiclesController, ProvidersController],
  providers: [CondominialService, AuditService, IdempotencyInterceptor],
  exports: [CondominialService],
})
export class CondominialModule {}
