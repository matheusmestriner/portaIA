import { create } from "zustand";
import * as authApi from "../api/auth";
import type { ChangePasswordResponse } from "../api/auth";
import { ApiError } from "../api/types";
import { decodeAccessToken, type AccessTokenClaims } from "./jwt";

const CSRF_STORAGE_KEY = "portalia_csrf_token";

type SessionStatus = "idle" | "loading" | "authenticated" | "unauthenticated";

interface SessionState {
  status: SessionStatus;
  accessToken: string | null;
  csrfToken: string | null;
  claims: AccessTokenClaims | null;
  mustChangePassword: boolean;
  /**
   * Bumped on every login()/logout(). A refresh() in flight captures the
   * epoch at start and discards its result if the epoch moved before it
   * resolves — otherwise a logout racing a slow refresh can have the
   * refresh's `.then` land after logout's `finally`, silently re-authenticating
   * the app with a token nobody asked for.
   */
  epoch: number;
  /** Initializes the session on app load by attempting a silent refresh from the httpOnly cookie. */
  init: () => Promise<void>;
  login: (email: string, password: string) => Promise<{ mustChangePassword: boolean }>;
  /** Rotates the refresh token and issues a fresh access token. Returns false if there was no valid session. */
  refresh: () => Promise<boolean>;
  logout: () => Promise<void>;
  /**
   * Applies the fresh session a successful change-password call returns.
   * The token used to submit that call still carries mustChangePassword=true
   * in its signed claims (a JWT can't update itself retroactively) — swapping
   * in the new one is required, not cosmetic, or MustChangePasswordGuard
   * keeps rejecting every other route server-side.
   */
  applyPasswordChange: (result: ChangePasswordResponse) => void;
}

function persistCsrf(token: string): void {
  try {
    sessionStorage.setItem(CSRF_STORAGE_KEY, token);
  } catch {
    // sessionStorage unavailable (e.g. private mode) — CSRF token stays in-memory only,
    // just means session restore after a hard reload will require a fresh login.
  }
}

function readPersistedCsrf(): string | null {
  try {
    return sessionStorage.getItem(CSRF_STORAGE_KEY);
  } catch {
    return null;
  }
}

const CSRF_COOKIE_NAME = "portalia_csrf";

/**
 * Cookies aren't port-scoped, so in local dev (frontend and backend both on
 * "localhost", different ports) this cookie is actually readable here even
 * though it was set by a different origin. In production, this only works
 * if the backend's cookie Domain covers the frontend's host too (sibling
 * subdomains under the same registrable domain) — sessionStorage is the
 * fallback for same-tab restores when it doesn't.
 */
function readCsrfCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${CSRF_COOKIE_NAME}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function resolveCsrfForRestore(): string | null {
  return readCsrfCookie() ?? readPersistedCsrf();
}

/**
 * The refresh endpoint rotates the token and revokes the one presented —
 * presenting an already-revoked token is treated as theft and nukes the
 * *entire* session chain (see backend RefreshTokensUseCase). Two concurrent
 * refresh() callers (React Strict Mode's double effect-invoke, a mount race
 * between init() and apiFetch's 401 retry, etc.) would both read the same
 * cookie and race: the loser presents a token the winner already rotated
 * away, triggering that theft response and logging the user out from under
 * themselves. Sharing one in-flight promise across all callers makes
 * refresh() safe to call concurrently from anywhere.
 */
let inFlightRefresh: Promise<boolean> | null = null;

export const useSessionStore = create<SessionState>((set, get) => ({
  status: "idle",
  accessToken: null,
  csrfToken: null,
  claims: null,
  mustChangePassword: false,
  epoch: 0,

  init: async () => {
    if (get().status !== "idle") return;
    set({ status: "loading" });
    const ok = await get().refresh();
    if (!ok) {
      set({ status: "unauthenticated" });
    }
  },

  login: async (email, password) => {
    set((state) => ({ status: "loading", epoch: state.epoch + 1 }));
    try {
      const result = await authApi.login(email, password);
      persistCsrf(result.csrfToken);
      set({
        status: "authenticated",
        accessToken: result.accessToken,
        csrfToken: result.csrfToken,
        claims: decodeAccessToken(result.accessToken),
        mustChangePassword: result.mustChangePassword,
      });
      return { mustChangePassword: result.mustChangePassword };
    } catch (err) {
      set({ status: "unauthenticated" });
      throw err;
    }
  },

  refresh: () => {
    if (inFlightRefresh) return inFlightRefresh;

    const epochAtStart = get().epoch;
    // True once we know this refresh's result is stale (a login/logout
    // happened while it was in flight) — its outcome must never be applied.
    const isStale = () => get().epoch !== epochAtStart;

    const run = async (): Promise<boolean> => {
      try {
        const csrfToken = get().csrfToken ?? resolveCsrfForRestore();
        const result = await authApi.refresh(csrfToken);
        if (isStale()) return get().status === "authenticated";
        persistCsrf(result.csrfToken);
        set({
          status: "authenticated",
          accessToken: result.accessToken,
          csrfToken: result.csrfToken,
          claims: decodeAccessToken(result.accessToken),
          mustChangePassword: result.mustChangePassword,
        });
        return true;
      } catch (err) {
        if (isStale()) return get().status === "authenticated";
        if (err instanceof ApiError && err.status === 401) {
          set({ status: "unauthenticated", accessToken: null, csrfToken: null, claims: null });
          return false;
        }
        // Network/server error: don't wipe an existing session over a transient failure.
        set({ status: get().accessToken ? "authenticated" : "unauthenticated" });
        return get().accessToken !== null;
      }
    };

    inFlightRefresh = run().finally(() => {
      inFlightRefresh = null;
    });
    return inFlightRefresh;
  },

  logout: async () => {
    set((state) => ({ epoch: state.epoch + 1 }));
    const csrfToken = get().csrfToken ?? readPersistedCsrf();
    const accessToken = get().accessToken;
    try {
      if (csrfToken) await authApi.logout(accessToken, csrfToken);
    } finally {
      try {
        sessionStorage.removeItem(CSRF_STORAGE_KEY);
      } catch {
        // best-effort cleanup only
      }
      set({ status: "unauthenticated", accessToken: null, csrfToken: null, claims: null, mustChangePassword: false });
    }
  },

  applyPasswordChange: (result) => {
    persistCsrf(result.csrfToken);
    set({
      accessToken: result.accessToken,
      csrfToken: result.csrfToken,
      claims: decodeAccessToken(result.accessToken),
      mustChangePassword: false,
    });
  },
}));
