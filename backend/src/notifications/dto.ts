import { z } from 'zod';

export const createAnnouncementSchema = z.object({
  condominiumId: z.string().uuid(),
  title: z.string().min(1).max(150),
  body: z.string().min(1).max(2000),
});
export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;
