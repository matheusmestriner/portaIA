import { createPlanSchema } from './dto';

describe('plans DTOs', () => {
  it('defaults modules to an empty array', () => {
    const result = createPlanSchema.parse({ key: 'basico', name: 'Plano Básico' });
    expect(result.modules).toEqual([]);
  });

  it('rejects a key that is not kebab-case', () => {
    expect(() => createPlanSchema.parse({ key: 'Plano Basico', name: 'x' })).toThrow();
  });
});
