import { createAnnouncementSchema } from './dto';

describe('notifications DTOs', () => {
  it('accepts a valid announcement', () => {
    const result = createAnnouncementSchema.parse({
      condominiumId: crypto.randomUUID(),
      title: 'Manutenção do elevador',
      body: 'O elevador social ficará indisponível amanhã das 8h às 12h.',
    });
    expect(result.title).toBe('Manutenção do elevador');
  });

  it('rejects an empty body', () => {
    expect(() =>
      createAnnouncementSchema.parse({ condominiumId: crypto.randomUUID(), title: 'x', body: '' }),
    ).toThrow();
  });
});
