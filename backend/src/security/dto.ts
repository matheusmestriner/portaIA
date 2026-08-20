import { z } from 'zod';
import { OccurrenceSeverity, OccurrenceStatus } from '@prisma/client';
import { paginationQuerySchema } from '../common/http/pagination';

export const listOccurrencesQuerySchema = paginationQuerySchema.extend({
  status: z.nativeEnum(OccurrenceStatus).optional(),
});
export type ListOccurrencesQuery = z.infer<typeof listOccurrencesQuerySchema>;

export const createOccurrenceSchema = z.object({
  condominiumId: z.string().uuid(),
  title: z.string().min(1).max(150),
  description: z.string().min(1).max(2000),
  severity: z.nativeEnum(OccurrenceSeverity).default(OccurrenceSeverity.LOW),
  reportedBy: z.string().min(1).max(150),
});
export type CreateOccurrenceInput = z.input<typeof createOccurrenceSchema>;

export const triggerPanicAlertSchema = z.object({
  condominiumId: z.string().uuid(),
  unitId: z.string().uuid().optional(),
  triggeredBy: z.string().min(1).max(150),
});
export type TriggerPanicAlertInput = z.infer<typeof triggerPanicAlertSchema>;

export const addBlockListEntrySchema = z.object({
  condominiumId: z.string().uuid(),
  document: z
    .string()
    .min(3)
    .max(30)
    .transform((v) => v.replace(/\D/g, '') || v.toUpperCase()),
  name: z.string().max(150).optional(),
  reason: z.string().min(1).max(300),
});
export type AddBlockListEntryInput = z.infer<typeof addBlockListEntrySchema>;
