import {
  createExtensionSchema,
  originateCallSchema,
  telephonyEventSchema,
  attachRecordingSchema,
} from './dto';

describe('telephony dto', () => {
  describe('createExtensionSchema', () => {
    it('accepts a numeric extension number', () => {
      const result = createExtensionSchema.parse({
        unitId: '11111111-1111-1111-1111-111111111111',
        number: '1042',
      });
      expect(result.number).toBe('1042');
    });

    it('rejects a non-numeric extension number', () => {
      expect(() =>
        createExtensionSchema.parse({ unitId: '11111111-1111-1111-1111-111111111111', number: 'abc1' }),
      ).toThrow();
    });
  });

  describe('originateCallSchema', () => {
    it('requires an externalCallId correlator', () => {
      expect(() =>
        originateCallSchema.parse({
          calleeExtensionId: '11111111-1111-1111-1111-111111111111',
          triggeredBy: 'porteiro@example.com',
        }),
      ).toThrow();
    });

    it('accepts a well-formed originate request', () => {
      const result = originateCallSchema.parse({
        calleeExtensionId: '11111111-1111-1111-1111-111111111111',
        triggeredBy: 'porteiro@example.com',
        externalCallId: 'corr-1',
      });
      expect(result.externalCallId).toBe('corr-1');
    });
  });

  describe('telephonyEventSchema', () => {
    it('discriminates CALL_STARTED and validates its nested data', () => {
      const result = telephonyEventSchema.parse({
        type: 'CALL_STARTED',
        data: {
          externalCallId: 'corr-1',
          condominiumId: '11111111-1111-1111-1111-111111111111',
          caller: { type: 'GATEHOUSE' },
          callee: { type: 'EXTENSION', extensionId: '22222222-2222-2222-2222-222222222222' },
        },
      });
      expect(result.type).toBe('CALL_STARTED');
    });

    it('discriminates CALL_ENDED and validates the terminal reason enum', () => {
      const result = telephonyEventSchema.parse({
        type: 'CALL_ENDED',
        data: { externalCallId: 'corr-1', reason: 'ABANDONED' },
      });
      expect(result.type).toBe('CALL_ENDED');
    });

    it('rejects an unknown event type', () => {
      expect(() =>
        telephonyEventSchema.parse({ type: 'CALL_UNKNOWN', data: {} }),
      ).toThrow();
    });

    it('rejects an invalid terminal reason', () => {
      expect(() =>
        telephonyEventSchema.parse({
          type: 'CALL_ENDED',
          data: { externalCallId: 'corr-1', reason: 'NOT_A_REASON' },
        }),
      ).toThrow();
    });
  });

  describe('attachRecordingSchema', () => {
    it('accepts valid recording metadata', () => {
      const result = attachRecordingSchema.parse({
        callId: '11111111-1111-1111-1111-111111111111',
        storageKey: 'recordings/2026/08/14/corr-1.wav',
        checksum: 'sha256:abc',
        sizeBytes: 12345,
        durationSeconds: 42,
      });
      expect(result.sizeBytes).toBe(12345);
    });

    it('rejects a non-positive duration', () => {
      expect(() =>
        attachRecordingSchema.parse({
          callId: '11111111-1111-1111-1111-111111111111',
          storageKey: 'recordings/2026/08/14/corr-1.wav',
          checksum: 'sha256:abc',
          sizeBytes: 12345,
          durationSeconds: 0,
        }),
      ).toThrow();
    });
  });
});
