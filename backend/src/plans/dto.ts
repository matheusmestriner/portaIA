import { z } from 'zod';

export const createPlanSchema = z.object({
  key: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'key deve ser kebab-case'),
  name: z.string().min(1).max(150),
  description: z.string().max(500).optional(),
  modules: z.array(z.string().min(1).max(60)).default([]),
});
export type CreatePlanInput = z.input<typeof createPlanSchema>;

export const assignPlanSchema = z.object({
  resaleId: z.string().uuid(),
  planId: z.string().uuid().nullable(),
});
export type AssignPlanInput = z.infer<typeof assignPlanSchema>;
