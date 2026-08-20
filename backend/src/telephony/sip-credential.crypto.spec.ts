import { randomBytes } from 'crypto';
import { decryptSipPassword, encryptSipPassword, generateSipPassword } from './sip-credential.crypto';

describe('sip-credential crypto', () => {
  const key = randomBytes(32).toString('hex');

  it('round-trips a password through encrypt/decrypt', () => {
    const plain = generateSipPassword();
    const encrypted = encryptSipPassword(plain, key);
    expect(encrypted).not.toContain(plain);
    expect(decryptSipPassword(encrypted, key)).toBe(plain);
  });

  it('produces a different ciphertext each time for the same password (random IV)', () => {
    const plain = 'same-password';
    const a = encryptSipPassword(plain, key);
    const b = encryptSipPassword(plain, key);
    expect(a).not.toBe(b);
  });

  it('fails to decrypt with the wrong key', () => {
    const otherKey = randomBytes(32).toString('hex');
    const encrypted = encryptSipPassword('secret', key);
    expect(() => decryptSipPassword(encrypted, otherKey)).toThrow();
  });

  it('generates passwords of reasonable length with no obvious pattern', () => {
    const a = generateSipPassword();
    const b = generateSipPassword();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(20);
  });
});
