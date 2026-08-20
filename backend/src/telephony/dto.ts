import { z } from 'zod';
import { CallPartyType } from '@prisma/client';

export const createExtensionSchema = z.object({
  unitId: z.string().uuid(),
  number: z
    .string()
    .min(2)
    .max(10)
    .regex(/^[0-9]+$/, 'number deve conter apenas dígitos'),
});
export type CreateExtensionInput = z.infer<typeof createExtensionSchema>;

export const originateCallSchema = z.object({
  calleeExtensionId: z.string().uuid(),
  triggeredBy: z.string().min(1).max(150),
  // Em uma integração real, o AMI "Originate" devolveria o id do canal; sem
  // Asterisk conectado na V01, quem chama a API gera esse correlator (ex.:
  // um UUID), do mesmo jeito que uma futura ponte real faria.
  externalCallId: z.string().min(1).max(150),
});
export type OriginateCallInput = z.infer<typeof originateCallSchema>;

const callPartyRefSchema = z.object({
  type: z.nativeEnum(CallPartyType),
  extensionId: z.string().uuid().optional(),
});

export const callStartedEventSchema = z.object({
  externalCallId: z.string().min(1).max(150),
  condominiumId: z.string().uuid(),
  caller: callPartyRefSchema,
  callee: callPartyRefSchema,
});
export type CallStartedEvent = z.infer<typeof callStartedEventSchema>;

export const callAnsweredEventSchema = z.object({
  externalCallId: z.string().min(1).max(150),
});
export type CallAnsweredEvent = z.infer<typeof callAnsweredEventSchema>;

export const callEndedEventSchema = z.object({
  externalCallId: z.string().min(1).max(150),
  reason: z.enum(['COMPLETED', 'MISSED', 'ABANDONED', 'REJECTED', 'TIMEOUT']),
});
export type CallEndedEvent = z.infer<typeof callEndedEventSchema>;

export const telephonyEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('CALL_STARTED'), data: callStartedEventSchema }),
  z.object({ type: z.literal('CALL_ANSWERED'), data: callAnsweredEventSchema }),
  z.object({ type: z.literal('CALL_ENDED'), data: callEndedEventSchema }),
]);
export type TelephonyEvent = z.infer<typeof telephonyEventSchema>;

// V01 doesn't integrate real object storage yet (see recordings.service.ts)
// — nothing reads or writes a file from this key today — but it's shaped
// like an object-store key now so a future MinIO/S3 integration doesn't
// inherit a path-traversal-shaped value that was never validated.
const SAFE_STORAGE_KEY = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;

export const attachRecordingSchema = z.object({
  callId: z.string().uuid(),
  storageKey: z
    .string()
    .min(1)
    .max(500)
    .regex(SAFE_STORAGE_KEY, 'storageKey inválida')
    .refine((key) => !key.includes('..'), 'storageKey inválida'),
  checksum: z.string().min(1).max(200),
  sizeBytes: z.number().int().positive(),
  durationSeconds: z.number().int().positive(),
  retentionDays: z.number().int().positive().max(3650).optional(),
});
export type AttachRecordingInput = z.infer<typeof attachRecordingSchema>;
