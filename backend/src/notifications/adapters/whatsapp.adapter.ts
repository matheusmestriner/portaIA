import { randomUUID } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NotificationChannelAdapter, NotificationSendResult } from './notification-channel-adapter.interface';
import { computeWebhookSignature } from '../../common/security/webhook-signature';
import type { EnvConfig } from '../../config/env.schema';

/**
 * Fala com a ponte Go + whatsmeow (serviço separado, ver docs/V01_SCOPE.md).
 *
 * Enquanto WHATSAPP_SERVICE_URL/SECRET não estiverem configurados, o adapter
 * continua sendo um stub honesto: relata "não configurado" em vez de fingir
 * entrega. Isso é proposital — a regra do projeto proíbe declarar o WhatsApp
 * homologado sem um teste real contra a ponte.
 *
 * As requisições para a ponte são assinadas com HMAC-SHA256 sobre
 * `${timestamp}.${nonce}.${body}` (mesmo esquema do webhook de telefonia),
 * porque a ponte não tem sessão de usuário: quem chama é este backend.
 */
@Injectable()
export class WhatsAppAdapter implements NotificationChannelAdapter {
  private readonly logger = new Logger(WhatsAppAdapter.name);

  constructor(private readonly config: ConfigService<EnvConfig, true>) {}

  isConfigured(): boolean {
    return !!this.baseUrl && !!this.secret;
  }

  async send(recipient: string, message: string): Promise<NotificationSendResult> {
    const baseUrl = this.baseUrl;
    const secret = this.secret;
    if (!baseUrl || !secret) {
      return {
        success: false,
        error: 'Ponte WhatsApp não configurada nesta instalação (defina WHATSAPP_SERVICE_URL e WHATSAPP_SERVICE_SECRET).',
      };
    }

    const phone = normalizePhone(recipient);
    if (!phone) {
      return { success: false, error: `Telefone inválido para WhatsApp: ${recipient}` };
    }

    const body = JSON.stringify({ to: phone, message });
    const timestamp = Date.now().toString();
    const nonce = randomUUID();
    const signature = computeWebhookSignature(secret, timestamp, nonce, body);

    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Timestamp': timestamp,
          'X-Webhook-Nonce': nonce,
          'X-Webhook-Signature': `sha256=${signature}`,
          'X-Idempotency-Key': nonce,
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        return { success: false, error: `Ponte WhatsApp respondeu ${response.status}: ${detail.slice(0, 200)}` };
      }
      return { success: true };
    } catch (error) {
      this.logger.warn({ err: error }, 'Falha ao chamar a ponte WhatsApp');
      return { success: false, error: error instanceof Error ? error.message : 'Falha ao contatar a ponte WhatsApp' };
    }
  }

  private get baseUrl(): string | undefined {
    return this.config.get('WHATSAPP_SERVICE_URL', { infer: true });
  }

  private get secret(): string | undefined {
    return this.config.get('WHATSAPP_SERVICE_SECRET', { infer: true });
  }
}

/** Normaliza para E.164 sem "+", assumindo Brasil quando não há DDI. */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 10) return null;
  if (digits.length <= 11) return `55${digits}`;
  return digits;
}
