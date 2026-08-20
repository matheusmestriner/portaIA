import { useSessionStore } from "../auth/session-store";
import { rawFetch, type RawFetchOptions } from "./raw-fetch";
import { ApiError } from "./types";

/**
 * Authenticated fetch for every feature module (not auth itself — that uses
 * raw-fetch directly to avoid a circular dependency on this file). Attaches
 * the current access token and, on a single 401, attempts one silent
 * refresh-and-retry before giving up.
 */
export async function apiFetch<T>(path: string, options: RawFetchOptions = {}): Promise<T> {
  const token = useSessionStore.getState().accessToken;
  const headers = { ...options.headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) };

  try {
    return await rawFetch<T>(path, { ...options, headers });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      const refreshed = await useSessionStore.getState().refresh();
      if (refreshed) {
        const freshToken = useSessionStore.getState().accessToken;
        return rawFetch<T>(path, {
          ...options,
          headers: { ...options.headers, ...(freshToken ? { Authorization: `Bearer ${freshToken}` } : {}) },
        });
      }
    }
    throw err;
  }
}
