import type { User } from '@prisma/client';

export interface UserResponse {
  id: string;
  email: string;
  role: string;
  resaleId: string | null;
  clientId: string | null;
  condominiumId: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

/** passwordHash never leaves this function. */
export function toUserResponse(u: User): UserResponse {
  return {
    id: u.id,
    email: u.email,
    role: u.role,
    resaleId: u.resaleId,
    clientId: u.clientId,
    condominiumId: u.condominiumId,
    isActive: u.isActive,
    mustChangePassword: u.mustChangePassword,
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
  };
}
