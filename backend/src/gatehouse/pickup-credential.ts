import { createHmac, randomBytes, randomInt } from 'crypto';

/**
 * Credencial de retirada de entrega. São dois portadores da mesma autorização:
 * um código numérico de 6 dígitos (que o morador recebe no WhatsApp e dita na
 * portaria) e um token longo embutido num QR Code (que o app do morador
 * exibe). Ambos são guardados apenas como HMAC — o valor em claro existe uma
 * única vez, na resposta que o gera.
 */
export function generatePickupCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export function generateQrToken(): string {
  return randomBytes(32).toString('base64url');
}

export function credentialHash(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('hex');
}

/**
 * O QR do app carrega uma URL de esquema próprio; a portaria pode escanear
 * isso ou digitar o código puro. Normaliza os dois para o valor comparável.
 */
export function extractCredential(raw: string): string {
  const value = raw.trim();
  const match = /[?&]token=([^&]+)/.exec(value);
  if (match) return decodeURIComponent(match[1]);
  return value;
}

export function buildQrPayload(deliveryId: string, token: string): string {
  return `portalia://retirada/${deliveryId}?token=${encodeURIComponent(token)}`;
}
