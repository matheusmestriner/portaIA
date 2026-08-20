import { createDeliverySchema, createVisitorSchema } from './dto';

describe('gatehouse DTOs', () => {
  it('accepts a visitor authorization window where validUntil is after validFrom', () => {
    const result = createVisitorSchema.parse({
      unitId: crypto.randomUUID(),
      name: 'João',
      validFrom: '2026-01-01T10:00:00Z',
      validUntil: '2026-01-01T18:00:00Z',
    });
    expect(result.validUntil.getTime()).toBeGreaterThan(result.validFrom.getTime());
  });

  it('rejects an empty delivery description', () => {
    expect(() => createDeliverySchema.parse({ unitId: crypto.randomUUID(), description: '' })).toThrow();
  });
});
