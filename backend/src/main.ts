import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import type { EnvConfig } from './config/env.schema';

async function bootstrap(): Promise<void> {
  // rawBody: true keeps the exact request bytes available as req.rawBody,
  // needed by HmacWebhookGuard to verify the telephony webhook signature
  // (JSON.stringify(parsedBody) is not guaranteed to match what the sender
  // actually signed byte-for-byte).
  // Explicit limit, not whatever body-parser's own default happens to be —
  // this is the ceiling for every JSON endpoint (uploads go through
  // multipart/FileInterceptor instead, with their own limit).
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    rawBody: true,
    bodyParser: false,
  });
  app.useBodyParser('json', { limit: '1mb' });
  app.useBodyParser('urlencoded', { limit: '1mb', extended: true });

  app.useLogger(app.get(Logger));
  app.use(helmet());
  app.use(cookieParser());
  app.enableShutdownHooks();
  app.setGlobalPrefix('api/v1', { exclude: ['health/live', 'health/ready'] });

  const config = app.get(ConfigService<EnvConfig, true>);
  const nodeEnv = config.get('NODE_ENV', { infer: true });

  // See TRUST_PROXY_HOPS doc in env.schema.ts — 0 (default) means Express
  // ignores X-Forwarded-For entirely, which is the safe-by-default choice.
  const trustProxyHops = config.get('TRUST_PROXY_HOPS', { infer: true });
  if (trustProxyHops > 0) {
    app.getHttpAdapter().getInstance().set('trust proxy', trustProxyHops);
  }

  // credentials: true + an exact origin (never '*') because the session
  // relies on cookies (refresh token + CSRF) sent cross-origin from the
  // Next.js frontend.
  app.enableCors({
    origin: config.get('FRONTEND_URL', { infer: true }),
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'Idempotency-Key'],
    exposedHeaders: ['X-Correlation-Id'],
  });

  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Portalia API')
      .setDescription('API da V01 do Portalia (portaria remota e híbrida)')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = config.get('PORT', { infer: true });
  await app.listen(port);
}

bootstrap();
