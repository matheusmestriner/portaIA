import { timingSafeEqual } from 'crypto';
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { computeWebhookSignature } from '../../common/security/webhook-signature';
import type { EnvConfig } from '../../config/env.schema';

const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000;

/**
 * Authenticates the telephony events webhook (POST /telephony/events) —
 * this endpoint isn't called by a logged-in user, it's called by a future
 * AMI/ARI bridge, so JwtAuthGuard doesn't apply. Signature covers
 * `${timestamp}.${nonce}.${rawBody}` with HMAC-SHA256 over a shared secret;
 * the nonce is recorded in webhook_nonces so the exact same request can
 * never be replayed, and the timestamp must be within a 5-minute window so
 * a leaked signature can't be replayed indefinitely either.
 */
@Injectable()
export class HmacWebhookGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService<EnvConfig, true>,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { rawBody?: Buffer }>();

    const signature = request.headers['x-signature'];
    const timestampHeader = request.headers['x-timestamp'];
    const nonce = request.headers['x-nonce'];

    if (typeof signature !== 'string' || typeof timestampHeader !== 'string' || typeof nonce !== 'string') {
      throw new ForbiddenException('Headers de assinatura ausentes (X-Signature, X-Timestamp, X-Nonce)');
    }

    const timestamp = Number(timestampHeader);
    if (!Number.isFinite(timestamp) || Math.abs(Date.now() - timestamp) > TIMESTAMP_TOLERANCE_MS) {
      throw new ForbiddenException('X-Timestamp fora da janela permitida');
    }

    const rawBody = request.rawBody ?? Buffer.from(JSON.stringify(request.body ?? {}));
    const secret = this.config.get('TELEPHONY_WEBHOOK_SECRET', { infer: true });
    const expected = computeWebhookSignature(secret, timestampHeader, nonce, rawBody.toString('utf8'));

    const signatureBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expected, 'hex');
    if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) {
      throw new ForbiddenException('Assinatura inválida');
    }

    try {
      await this.prisma.webhookNonce.create({ data: { nonce } });
    } catch {
      throw new ForbiddenException('Nonce já utilizado (replay detectado)');
    }

    return true;
  }
}
