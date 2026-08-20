import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule } from './config/config.module';
import { LoggingModule } from './common/logging/logging.module';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './common/storage/storage.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { ResidentAuthModule } from './resident-auth/resident-auth.module';
import { ResidentModule } from './resident/resident.module';
import { FeatureFlagsModule } from './feature-flags/feature-flags.module';
import { CondominialModule } from './condominial/condominial.module';
import { GatehouseModule } from './gatehouse/gatehouse.module';
import { SecurityModule } from './security/security.module';
import { TenancyModule } from './tenancy/tenancy.module';
import { UsersModule } from './users/users.module';
import { AuditModule } from './common/audit/audit.module';
import { WhiteLabelModule } from './white-label/white-label.module';
import { PlansModule } from './plans/plans.module';
import { ReportsModule } from './reports/reports.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PrivacyModule } from './privacy/privacy.module';
import { TelephonyModule } from './telephony/telephony.module';
import { VmsModule } from './vms/vms.module';
import { JwtAuthGuard } from './auth/http/jwt-auth.guard';
import { PermissionsGuard } from './auth/http/permissions.guard';
import { MustChangePasswordGuard } from './auth/http/must-change-password.guard';
import { HttpExceptionFilter } from './common/http/http-exception.filter';

@Module({
  imports: [
    ConfigModule,
    LoggingModule,
    PrismaModule,
    StorageModule,
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    HealthModule,
    AuthModule,
    ResidentAuthModule,
    ResidentModule,
    FeatureFlagsModule,
    CondominialModule,
    GatehouseModule,
    SecurityModule,
    TenancyModule,
    UsersModule,
    AuditModule,
    WhiteLabelModule,
    PlansModule,
    ReportsModule,
    NotificationsModule,
    PrivacyModule,
    TelephonyModule,
    VmsModule,
  ],
  providers: [
    // Order matters: rate limit first, then "is this token valid" (populates
    // request.actor), then "is a password change blocking everything else",
    // then "is this actor allowed to call this handler".
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: MustChangePasswordGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
