import { addBlockListEntrySchema, createOccurrenceSchema } from './dto';
import { OccurrenceSeverity } from '@prisma/client';

describe('security DTOs', () => {
  it('defaults occurrence severity to LOW', () => {
    const result = createOccurrenceSchema.parse({
      condominiumId: crypto.randomUUID(),
      title: 'Vazamento',
      description: 'Vazamento no hall do bloco B',
      reportedBy: 'Porteiro João',
    });
    expect(result.severity).toBe(OccurrenceSeverity.LOW);
  });

  it('strips non-digits from a CPF-shaped block list document', () => {
    const result = addBlockListEntrySchema.parse({
      condominiumId: crypto.randomUUID(),
      document: '123.456.789-01',
      reason: 'Comportamento agressivo',
    });
    expect(result.document).toBe('12345678901');
  });
});
