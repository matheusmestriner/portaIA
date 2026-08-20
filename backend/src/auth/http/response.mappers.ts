import type { User } from '@prisma/client';

export interface MeResponse {
  id: string;
  email: string;
  role: User['role'];
  resaleId: string | null;
  clientId: string | null;
  condominiumId: string | null;
  mustChangePassword: boolean;
}

/** passwordHash never leaves this function. */
export function toMeResponse(user: User): MeResponse {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    resaleId: user.resaleId,
    clientId: user.clientId,
    condominiumId: user.condominiumId,
    mustChangePassword: user.mustChangePassword,
  };
}
