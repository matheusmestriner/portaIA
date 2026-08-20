import { createProviderSchema, createUnitSchema, createVehicleSchema } from './dto';

describe('condominial DTOs', () => {
  it('normalizes a vehicle plate to uppercase without punctuation', () => {
    const result = createVehicleSchema.parse({ unitId: crypto.randomUUID(), plate: 'abc-1d23' });
    expect(result.plate).toBe('ABC1D23');
  });

  it('rejects a plate that is too short', () => {
    expect(() => createVehicleSchema.parse({ unitId: crypto.randomUUID(), plate: 'AB1' })).toThrow();
  });

  it('strips non-digits from a provider document', () => {
    const result = createProviderSchema.parse({
      condominiumId: crypto.randomUUID(),
      name: 'Fornecedor X',
      document: '123.456.789-01',
    });
    expect(result.document).toBe('12345678901');
  });

  it('rejects a unit identifier that is empty', () => {
    expect(() => createUnitSchema.parse({ condominiumId: crypto.randomUUID(), identifier: '' })).toThrow();
  });
});
