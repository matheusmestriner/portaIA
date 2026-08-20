import { z } from 'zod';
import { UserRole } from '@prisma/client';

export const createUserSchema = z.object({
  email: z.string().email(),
  // Senha inicial definida pelo administrador; troca é sempre obrigatória
  // no primeiro login (mesma regra do bootstrap do Super Admin).
  password: z.string().min(12, 'A senha deve ter ao menos 12 caracteres'),
  role: z.nativeEnum(UserRole),
  // Ignorados quando o escopo do ator já os determina (ver UsersService) —
  // nunca confiar em tenant id enviado pelo cliente.
  resaleId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  condominiumId: z.string().uuid().optional(),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;
