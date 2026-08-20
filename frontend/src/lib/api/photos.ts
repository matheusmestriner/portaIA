import { useSessionStore } from "../auth/session-store";
import { ApiError, type ApiErrorBody } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3101/api/v1";

export type PhotoCategory =
  | "DELIVERY_RECEIPT"
  | "DELIVERY_PICKUP"
  | "KEY_CHECKOUT"
  | "KEY_RETURN"
  | "PROVIDER_ACCESS"
  | "OCCURRENCE";

export interface OperationalPhotoResponse {
  id: string;
  condominiumId: string;
  category: PhotoCategory;
  source: string;
  contentType: string;
  sizeBytes: number;
  originalName: string | null;
  url: string;
  createdAt: string;
}

/**
 * Upload multipart — não passa pelo apiFetch porque este monta um corpo JSON
 * com Content-Type fixo; aqui o browser precisa definir o boundary sozinho.
 */
export async function uploadPhoto(params: {
  condominiumId: string;
  category: PhotoCategory;
  source: "camera" | "computer";
  file: File;
}): Promise<OperationalPhotoResponse> {
  const form = new FormData();
  form.append("condominiumId", params.condominiumId);
  form.append("category", params.category);
  form.append("source", params.source);
  form.append("file", params.file);

  const send = async (token: string | null) => {
    const res = await fetch(`${API_URL}/gatehouse/photos`, {
      method: "POST",
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: form,
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : undefined;
    if (!res.ok) throw new ApiError(res.status, data as ApiErrorBody);
    return data as OperationalPhotoResponse;
  };

  try {
    return await send(useSessionStore.getState().accessToken);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      const refreshed = await useSessionStore.getState().refresh();
      if (refreshed) return send(useSessionStore.getState().accessToken);
    }
    throw err;
  }
}
