import { setWhiteLabelSchema } from './dto';
import { FeatureFlagScope } from '@prisma/client';

describe('white-label DTOs', () => {
  it('accepts a valid 6-digit hex color', () => {
    const result = setWhiteLabelSchema.parse({ scope: FeatureFlagScope.GLOBAL, primaryColor: '#1A2B3C' });
    expect(result.primaryColor).toBe('#1A2B3C');
  });

  it('rejects a 3-digit hex color', () => {
    expect(() => setWhiteLabelSchema.parse({ scope: FeatureFlagScope.GLOBAL, primaryColor: '#fff' })).toThrow();
  });

  it('rejects a non-url logoUrl', () => {
    expect(() => setWhiteLabelSchema.parse({ scope: FeatureFlagScope.GLOBAL, logoUrl: 'not-a-url' })).toThrow();
  });
});
