import { buildQrPayload, extractCredential, generatePickupCode, generateQrToken } from './pickup-credential';

describe('pickup credential', () => {
  it('generates a zero-padded 6-digit code', () => {
    for (let i = 0; i < 200; i += 1) {
      expect(generatePickupCode()).toMatch(/^[0-9]{6}$/);
    }
  });

  it('extracts the token from a scanned QR payload and passes a bare code through', () => {
    const token = generateQrToken();
    const payload = buildQrPayload('11111111-1111-1111-1111-111111111111', token);
    expect(extractCredential(payload)).toBe(token);
    expect(extractCredential('  123456 ')).toBe('123456');
  });

  it('round-trips a token containing url-unsafe characters through the QR payload', () => {
    const payload = buildQrPayload('11111111-1111-1111-1111-111111111111', 'a+b/c=d');
    expect(extractCredential(payload)).toBe('a+b/c=d');
  });

  it('generates distinct QR tokens', () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateQrToken()));
    expect(tokens.size).toBe(100);
  });
});
