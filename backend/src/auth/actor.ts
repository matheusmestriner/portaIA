import type { UserRole } from '@prisma/client';

/** The authenticated caller of a use case, resolved from a verified access token — never from client-supplied payload. */
export interface Actor {
  id: string;
  role: UserRole;
  resaleId: string | null;
  clientId: string | null;
  condominiumId: string | null;
  mustChangePassword: boolean;
}
