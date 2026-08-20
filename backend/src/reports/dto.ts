import { z } from 'zod';

export const condominiumReportQuerySchema = z.object({
  condominiumId: z.string().uuid(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
export type CondominiumReportQuery = z.infer<typeof condominiumReportQuerySchema>;
