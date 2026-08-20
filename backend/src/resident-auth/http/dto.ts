import { z } from 'zod';

export const residentLoginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
});
export type ResidentLoginBody = z.infer<typeof residentLoginBodySchema>;

export const residentRefreshBodySchema = z.object({
  refreshToken: z.string().min(1).max(500),
});
export type ResidentRefreshBody = z.infer<typeof residentRefreshBodySchema>;

export const residentChangePasswordBodySchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(12, 'A nova senha deve ter ao menos 12 caracteres').max(72, 'A nova senha deve ter no máximo 72 caracteres'),
});
export type ResidentChangePasswordBody = z.infer<typeof residentChangePasswordBodySchema>;
