import { validateEnv } from './env.schema';

describe('validateEnv', () => {
  const validBase = {
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/portalia',
    JWT_ACCESS_SECRET: 'a'.repeat(32),
    TELEPHONY_WEBHOOK_SECRET: 'b'.repeat(32),
    TELEPHONY_SIP_SECRET_KEY: 'c'.repeat(64),
    PICKUP_CREDENTIAL_SECRET: 'd'.repeat(32),
  };

  it('applies defaults for optional fields', () => {
    const result = validateEnv(validBase);
    expect(result.NODE_ENV).toBe('development');
    expect(result.PORT).toBe(3101);
    expect(result.LOG_LEVEL).toBe('info');
  });

  it('coerces PORT from string to number', () => {
    const result = validateEnv({ ...validBase, PORT: '4000' });
    expect(result.PORT).toBe(4000);
  });

  it('rejects missing DATABASE_URL', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL/);
  });

  it('rejects an invalid NODE_ENV', () => {
    expect(() => validateEnv({ ...validBase, NODE_ENV: 'staging' })).toThrow();
  });

  it('rejects a bootstrap password shorter than 12 chars', () => {
    expect(() =>
      validateEnv({ ...validBase, SUPER_ADMIN_BOOTSTRAP_PASSWORD: 'short' }),
    ).toThrow();
  });

  it('accepts a valid bootstrap email and password', () => {
    const result = validateEnv({
      ...validBase,
      SUPER_ADMIN_BOOTSTRAP_EMAIL: 'admin@example.com',
      SUPER_ADMIN_BOOTSTRAP_PASSWORD: 'a-strong-password-123',
    });
    expect(result.SUPER_ADMIN_BOOTSTRAP_EMAIL).toBe('admin@example.com');
  });
});
