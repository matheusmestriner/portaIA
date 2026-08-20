import { ConfigService } from '@nestjs/config';
import { WhatsAppAdapter, normalizePhone } from './whatsapp.adapter';
import type { EnvConfig } from '../../config/env.schema';

function adapterWith(values: Partial<EnvConfig>): WhatsAppAdapter {
  const config = { get: (key: keyof EnvConfig) => values[key] } as unknown as ConfigService<EnvConfig, true>;
  return new WhatsAppAdapter(config);
}

describe('WhatsAppAdapter', () => {
  describe('when the bridge is not configured', () => {
    const adapter = adapterWith({});

    it('reports itself as not configured', () => {
      expect(adapter.isConfigured()).toBe(false);
    });

    it('fails honestly instead of pretending to deliver', async () => {
      const result = await adapter.send('+5511999999999', 'hello');
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/não configurada/i);
    });
  });

  describe('when the bridge is configured', () => {
    const adapter = adapterWith({
      WHATSAPP_SERVICE_URL: 'http://wa.local',
      WHATSAPP_SERVICE_SECRET: 'x'.repeat(32),
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('reports itself as configured', () => {
      expect(adapter.isConfigured()).toBe(true);
    });

    it('signs the request with HMAC over timestamp.nonce.body', async () => {
      const fetchMock = jest
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(new Response('', { status: 200 }));

      const result = await adapter.send('11999999999', 'seu código é 123456');
      expect(result.success).toBe(true);

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('http://wa.local/messages');
      const headers = init?.headers as Record<string, string>;
      expect(headers['X-Webhook-Signature']).toMatch(/^sha256=[0-9a-f]{64}$/);
      expect(headers['X-Webhook-Nonce']).toBeTruthy();
      expect(JSON.parse(init?.body as string)).toEqual({ to: '5511999999999', message: 'seu código é 123456' });
    });

    it('surfaces a non-2xx bridge response as a failure', async () => {
      jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('session not paired', { status: 409 }));
      const result = await adapter.send('11999999999', 'oi');
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/409/);
    });

    it('rejects an unusable phone number before calling the bridge', async () => {
      const fetchMock = jest.spyOn(globalThis, 'fetch');
      const result = await adapter.send('123', 'oi');
      expect(result.success).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});

describe('normalizePhone', () => {
  it('prefixes the Brazilian country code when absent', () => {
    expect(normalizePhone('(11) 99999-9999')).toBe('5511999999999');
    expect(normalizePhone('1133334444')).toBe('551133334444');
  });

  it('keeps an already-international number as is', () => {
    expect(normalizePhone('+55 11 99999-9999')).toBe('5511999999999');
  });

  it('rejects a number that is too short to be real', () => {
    expect(normalizePhone('99999')).toBeNull();
  });
});
