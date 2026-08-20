import { ApiError, type ApiErrorBody } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3101/api/v1";

export interface RawFetchOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
}

/**
 * Base fetch with no auth-token/refresh logic — used by the auth module
 * itself (login/refresh/logout) to avoid a circular dependency with the
 * session store. Always sends cookies: the httpOnly refresh cookie and the
 * non-httpOnly CSRF cookie both need to ride along on auth calls.
 */
export async function rawFetch<T>(path: string, options: RawFetchOptions = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;

  if (!res.ok) {
    throw new ApiError(res.status, data as ApiErrorBody);
  }

  return data as T;
}
