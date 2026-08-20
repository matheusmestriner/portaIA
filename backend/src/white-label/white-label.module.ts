import { Module } from '@nestjs/common';
import { WhiteLabelService } from './white-label.service';
import { WhiteLabelController } from './http/white-label.controller';
import { IdempotencyInterceptor } from '../common/http/idempotency.interceptor';

@Module({
  controllers: [WhiteLabelController],
  providers: [WhiteLabelService, IdempotencyInterceptor],
  exports: [WhiteLabelService],
})
export class WhiteLabelModule {}
