import { rawFetch } from "./raw-fetch";

export interface LoginResponse {
  accessToken: string;
  mustChangePassword: boolean;
  csrfToken: string;
}

export interface RefreshResponse {
  accessToken: string;
  csrfToken: string;
  mustChangePassword: boolean;
}

export function login(email: string, password: string): Promise<LoginResponse> {
  return rawFetch<LoginResponse>("/auth/login", { method: "POST", body: { email, password } });
}

export function refresh(csrfToken?: string | null): Promise<RefreshResponse> {
  return rawFetch<RefreshResponse>("/auth/refresh", {
    method: "POST",
    headers: csrfToken ? { "X-CSRF-Token": csrfToken } : undefined,
  });
}

export function logout(accessToken: string | null, csrfToken: string): Promise<void> {
  return rawFetch<void>("/auth/logout", {
    method: "POST",
    headers: {
      "X-CSRF-Token": csrfToken,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  });
}

export interface ChangePasswordResponse {
  accessToken: string;
  csrfToken: string;
}

/**
 * Returns a fresh session, not void: the access token used to call this
 * still carries mustChangePassword=true in its signed claims (a JWT can't
 * update itself retroactively), so the caller must swap it in immediately —
 * MustChangePasswordGuard would keep rejecting every other route with the
 * old one otherwise.
 */
export function changePassword(
  accessToken: string,
  currentPassword: string,
  newPassword: string,
): Promise<ChangePasswordResponse> {
  return rawFetch<ChangePasswordResponse>("/auth/change-password", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: { currentPassword, newPassword },
  });
}
