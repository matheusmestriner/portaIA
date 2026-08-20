import { createHmac } from 'crypto';

/**
 * Portalia's shared HMAC-SHA256 scheme for signing/verifying requests between
 * this backend and callers that have no user session (the telephony events
 * webhook, the WhatsApp bridge): sign over `${timestamp}.${nonce}.${body}`.
 */
export function computeWebhookSignature(secret: string, timestamp: string, nonce: string, body: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${nonce}.${body}`).digest('hex');
}
