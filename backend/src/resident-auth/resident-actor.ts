/** The authenticated resident caller of a use case, resolved from a verified resident access token — never from client-supplied payload. */
export interface ResidentActor {
  id: string;
  unitId: string;
  condominiumId: string;
  clientId: string;
  resaleId: string;
  mustChangePassword: boolean;
}
