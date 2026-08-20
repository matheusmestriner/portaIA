import { createResaleSchema } from './dto';

describe('tenancy DTOs', () => {
  it('accepts a kebab-case slug', () => {
    const result = createResaleSchema.parse({ name: 'Revenda X', slug: 'revenda-x' });
    expect(result.slug).toBe('revenda-x');
  });

  it('rejects a slug with uppercase or spaces', () => {
    expect(() => createResaleSchema.parse({ name: 'Revenda X', slug: 'Revenda X' })).toThrow();
  });

  it('rejects a slug with underscores', () => {
    expect(() => createResaleSchema.parse({ name: 'Revenda X', slug: 'revenda_x' })).toThrow();
  });
});
