import { apiFetch } from "./client";
import type { Paginated } from "./types";
import type { UserRole } from "../auth/permissions";

export interface UserResponse {
  id: string;
  email: string;
  role: UserRole;
  resaleId: string | null;
  clientId: string | null;
  condominiumId: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export function listUsers(page: number, pageSize: number): Promise<Paginated<UserResponse>> {
  return apiFetch(`/users?page=${page}&pageSize=${pageSize}`);
}

export interface CreateUserInput {
  email: string;
  password: string;
  role: UserRole;
  resaleId?: string;
  clientId?: string;
  condominiumId?: string;
}

export function createUser(input: CreateUserInput, idempotencyKey: string): Promise<UserResponse> {
  return apiFetch("/users", {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: input,
  });
}
