import { apiFetch } from "./client";
import type { Paginated } from "./types";

export type OccurrenceSeverity = "LOW" | "MEDIUM" | "HIGH";
export type OccurrenceStatus = "OPEN" | "IN_PROGRESS" | "CLOSED";

export interface OccurrenceResponse {
  id: string;
  condominiumId: string;
  title: string;
  description: string;
  severity: OccurrenceSeverity;
  status: OccurrenceStatus;
  reportedBy: string;
  createdAt: string;
}

export function listOccurrences(
  condominiumId: string,
  page: number,
  pageSize: number,
  status?: OccurrenceStatus,
): Promise<Paginated<OccurrenceResponse>> {
  const statusParam = status ? `&status=${status}` : "";
  return apiFetch(`/security/occurrences?condominiumId=${condominiumId}&page=${page}&pageSize=${pageSize}${statusParam}`);
}

export interface CreateOccurrenceInput {
  condominiumId: string;
  title: string;
  description: string;
  severity?: OccurrenceSeverity;
  reportedBy: string;
}

export function createOccurrence(input: CreateOccurrenceInput, idempotencyKey: string): Promise<OccurrenceResponse> {
  return apiFetch("/security/occurrences", {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: input,
  });
}

export interface PanicAlertResponse {
  id: string;
  condominiumId: string;
  unitId: string | null;
  triggeredBy: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export function listPanicAlerts(
  condominiumId: string,
  page: number,
  pageSize: number,
): Promise<Paginated<PanicAlertResponse>> {
  return apiFetch(`/security/panic-alerts?condominiumId=${condominiumId}&page=${page}&pageSize=${pageSize}`);
}

export interface TriggerPanicAlertInput {
  condominiumId: string;
  unitId?: string;
  triggeredBy: string;
}

export function triggerPanicAlert(
  input: TriggerPanicAlertInput,
  idempotencyKey: string,
): Promise<PanicAlertResponse> {
  return apiFetch("/security/panic-alerts", {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: input,
  });
}

export interface BlockListEntryResponse {
  id: string;
  condominiumId: string;
  document: string;
  name: string | null;
  reason: string;
  createdAt: string;
}

export function listBlockListEntries(
  condominiumId: string,
  page: number,
  pageSize: number,
): Promise<Paginated<BlockListEntryResponse>> {
  return apiFetch(`/security/block-list?condominiumId=${condominiumId}&page=${page}&pageSize=${pageSize}`);
}

export interface AddBlockListEntryInput {
  condominiumId: string;
  document: string;
  name?: string;
  reason: string;
}

export function addBlockListEntry(
  input: AddBlockListEntryInput,
  idempotencyKey: string,
): Promise<BlockListEntryResponse> {
  return apiFetch("/security/block-list", {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: input,
  });
}
