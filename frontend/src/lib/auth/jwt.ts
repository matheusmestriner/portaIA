import type { UserRole } from "./permissions";

export interface AccessTokenClaims {
  sub: string;
  role: UserRole;
  resaleId: string | null;
  clientId: string | null;
  condominiumId: string | null;
  iat: number;
  exp: number;
}

/**
 * Decodes the JWT payload without verifying the signature — verification is
 * the backend's job on every request. This only reads claims already handed
 * to the client to drive UI (nav visibility, scope labels).
 */
export function decodeAccessToken(token: string): AccessTokenClaims | null {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "="));
    return JSON.parse(json) as AccessTokenClaims;
  } catch {
    return null;
  }
}
