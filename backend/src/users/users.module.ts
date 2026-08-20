import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { AuditService } from '../common/audit/audit.service';
import { AuthModule } from '../auth/auth.module';
import { UsersController } from './http/users.controller';
import { IdempotencyInterceptor } from '../common/http/idempotency.interceptor';

@Module({
  imports: [AuthModule],
  controllers: [UsersController],
  providers: [UsersService, AuditService, IdempotencyInterceptor],
  exports: [UsersService],
})
export class UsersModule {}
