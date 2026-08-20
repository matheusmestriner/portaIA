import { z } from 'zod';

// 200 chars is generous headroom over any real password while still capping
// the payload bcrypt.compare() ends up hashing — without a ceiling here, a
// multi-megabyte "password" string is accepted, buffered, and run through
// bcrypt's deliberately expensive hashing before it's rejected.
export const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
});
export type LoginBody = z.infer<typeof loginBodySchema>;

export const changePasswordBodySchema = z.object({
  currentPassword: z.string().min(1).max(200),
  // bcrypt silently truncates at 72 *bytes* — capping at 72 here (chars, not
  // bytes) is conservative for multi-byte UTF-8 but means every accepted
  // password is guaranteed to survive the hash intact, not just its prefix.
  newPassword: z.string().min(12, 'A nova senha deve ter ao menos 12 caracteres').max(72, 'A nova senha deve ter no máximo 72 caracteres'),
});
export type ChangePasswordBody = z.infer<typeof changePasswordBodySchema>;
