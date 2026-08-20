import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import type { EnvConfig } from '../../config/env.schema';

// Accepted so an upstream system's correlation id can propagate through our
// logs — but only if it looks like an id. Unvalidated, this becomes a
// client-controlled string echoed into every log line for the request AND
// back in the X-Correlation-Id response header: control characters open log
// injection, and there's no length cap otherwise.
const CORRELATION_ID_PATTERN = /^[a-zA-Z0-9_-]{1,100}$/;

@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvConfig, true>) => {
        const nodeEnv = config.get('NODE_ENV', { infer: true });
        const isProduction = nodeEnv === 'production';

        return {
          pinoHttp: {
            level: config.get('LOG_LEVEL', { infer: true }),
            transport: isProduction
              ? undefined
              : { target: 'pino-pretty', options: { colorize: true, singleLine: true } },
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'req.body.password',
                'req.body.token',
                'res.headers["set-cookie"]',
              ],
              censor: '[REDACTED]',
            },
            genReqId: (req: { headers: Record<string, unknown> }) => {
              const provided = req.headers['x-correlation-id'];
              return typeof provided === 'string' && CORRELATION_ID_PATTERN.test(provided)
                ? provided
                : crypto.randomUUID();
            },
          },
        };
      },
    }),
  ],
  exports: [LoggerModule],
})
export class LoggingModule {}
