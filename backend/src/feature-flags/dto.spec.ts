import { setFeatureFlagSchema } from './dto';
import { FeatureFlagScope } from '@prisma/client';

describe('feature-flags DTOs', () => {
  it('accepts a snake_case key', () => {
    const result = setFeatureFlagSchema.parse({ key: 'whatsapp_adapter', scope: FeatureFlagScope.GLOBAL, enabled: true });
    expect(result.key).toBe('whatsapp_adapter');
  });

  it('rejects a key with hyphens', () => {
    expect(() =>
      setFeatureFlagSchema.parse({ key: 'whatsapp-adapter', scope: FeatureFlagScope.GLOBAL, enabled: true }),
    ).toThrow();
  });
});
