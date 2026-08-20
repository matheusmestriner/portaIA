import { createDataSubjectRequestSchema, createLegalHoldSchema } from './dto';
import { DataSubjectRequestType } from '@prisma/client';

describe('privacy DTOs', () => {
  it('strips non-digits from a requester document', () => {
    const result = createDataSubjectRequestSchema.parse({
      condominiumId: crypto.randomUUID(),
      requesterName: 'Fulano',
      requesterDocument: '123.456.789-01',
      type: DataSubjectRequestType.ACCESS,
    });
    expect(result.requesterDocument).toBe('12345678901');
  });

  it('strips non-digits from a legal hold document', () => {
    const result = createLegalHoldSchema.parse({
      condominiumId: crypto.randomUUID(),
      subjectDocument: '987.654.321-00',
      reason: 'Processo judicial em andamento',
    });
    expect(result.subjectDocument).toBe('98765432100');
  });

  it('rejects an unknown request type', () => {
    expect(() =>
      createDataSubjectRequestSchema.parse({
        condominiumId: crypto.randomUUID(),
        requesterName: 'x',
        requesterDocument: '12345678901',
        type: 'NOT_A_TYPE',
      }),
    ).toThrow();
  });
});
