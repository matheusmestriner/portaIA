import { z } from 'zod';
import { DataSubjectRequestType } from '@prisma/client';

export const recordConsentSchema = z.object({
  condominiumId: z.string().uuid(),
  subjectName: z.string().min(1).max(150),
  subjectDocument: z.string().max(30).optional(),
  purpose: z.string().min(1).max(100),
  granted: z.boolean(),
});
export type RecordConsentInput = z.infer<typeof recordConsentSchema>;

export const createDataSubjectRequestSchema = z.object({
  condominiumId: z.string().uuid(),
  requesterName: z.string().min(1).max(150),
  requesterDocument: z
    .string()
    .min(3)
    .max(30)
    .transform((v) => v.replace(/\D/g, '') || v.toUpperCase()),
  type: z.nativeEnum(DataSubjectRequestType),
  details: z.string().max(2000).optional(),
});
export type CreateDataSubjectRequestInput = z.infer<typeof createDataSubjectRequestSchema>;

export const resolveDataSubjectRequestSchema = z.object({
  approve: z.boolean(),
  resolutionNotes: z.string().max(2000).optional(),
});
export type ResolveDataSubjectRequestInput = z.infer<typeof resolveDataSubjectRequestSchema>;

export const createLegalHoldSchema = z.object({
  condominiumId: z.string().uuid(),
  subjectDocument: z
    .string()
    .min(3)
    .max(30)
    .transform((v) => v.replace(/\D/g, '') || v.toUpperCase()),
  reason: z.string().min(1).max(500),
});
export type CreateLegalHoldInput = z.infer<typeof createLegalHoldSchema>;
