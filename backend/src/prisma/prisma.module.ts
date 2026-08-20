import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma.service';
import type { EnvConfig } from '../config/env.schema';

@Global()
@Module({
  providers: [
    {
      provide: PrismaService,
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvConfig, true>) =>
        new PrismaService(config.get('APP_DATABASE_URL', { infer: true })),
    },
  ],
  exports: [PrismaService],
})
export class PrismaModule {}
