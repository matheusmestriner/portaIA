import { condominiumReportQuerySchema } from './dto';

describe('reports DTOs', () => {
  it('accepts a query with only condominiumId', () => {
    const result = condominiumReportQuerySchema.parse({ condominiumId: crypto.randomUUID() });
    expect(result.from).toBeUndefined();
    expect(result.to).toBeUndefined();
  });

  it('coerces from/to into Date instances', () => {
    const result = condominiumReportQuerySchema.parse({
      condominiumId: crypto.randomUUID(),
      from: '2026-01-01',
      to: '2026-01-31',
    });
    expect(result.from).toBeInstanceOf(Date);
    expect(result.to).toBeInstanceOf(Date);
  });

  it('rejects a non-uuid condominiumId', () => {
    expect(() => condominiumReportQuerySchema.parse({ condominiumId: 'not-a-uuid' })).toThrow();
  });
});
