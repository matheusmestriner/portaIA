import { Module } from '@nestjs/common';
import { ResidentService } from './resident.service';
import { AuditService } from '../common/audit/audit.service';
import { ResidentAuthModule } from '../resident-auth/resident-auth.module';
import { ResidentProfileController } from './http/resident-profile.controller';
import { ResidentDashboardController } from './http/resident-dashboard.controller';
import { ResidentAnnouncementsController } from './http/resident-announcements.controller';
import { ResidentDeliveriesController } from './http/resident-deliveries.controller';
import { ResidentTelephonyController } from './http/resident-telephony.controller';
import { ResidentIdempotencyInterceptor } from '../common/http/resident-idempotency.interceptor';

@Module({
  imports: [ResidentAuthModule],
  controllers: [
    ResidentProfileController,
    ResidentDashboardController,
    ResidentAnnouncementsController,
    ResidentDeliveriesController,
    ResidentTelephonyController,
  ],
  providers: [ResidentService, AuditService, ResidentIdempotencyInterceptor],
})
export class ResidentModule {}
