import { z } from 'zod';
import { FeatureFlagScope } from '@prisma/client';

export const setFeatureFlagSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9]+(_[a-z0-9]+)*$/, 'key deve ser snake_case'),
  scope: z.nativeEnum(FeatureFlagScope),
  scopeId: z.string().uuid().optional(),
  enabled: z.boolean(),
});
export type SetFeatureFlagInput = z.infer<typeof setFeatureFlagSchema>;
