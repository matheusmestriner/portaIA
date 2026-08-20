import { Module } from '@nestjs/common';
import { FeatureFlagsService } from './feature-flags.service';
import { FeatureFlagsController } from './http/feature-flags.controller';
import { IdempotencyInterceptor } from '../common/http/idempotency.interceptor';

@Module({
  controllers: [FeatureFlagsController],
  providers: [FeatureFlagsService, IdempotencyInterceptor],
  exports: [FeatureFlagsService],
})
export class FeatureFlagsModule {}
