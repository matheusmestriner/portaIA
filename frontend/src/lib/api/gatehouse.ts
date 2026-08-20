import { apiFetch } from "./client";
import type { Paginated } from "./types";

export interface VisitorResponse {
  id: string;
  unitId: string;
  condominiumId: string;
  name: string;
  document: string | null;
  createdAt: string;
}

export function listVisitors(
  condominiumId: string,
  page: number,
  pageSize: number,
): Promise<Paginated<VisitorResponse>> {
  return apiFetch(`/gatehouse/visitors?condominiumId=${condominiumId}&page=${page}&pageSize=${pageSize}`);
}

export interface CreateVisitorInput {
  unitId: string;
  name: string;
  document?: string;
  validFrom: string;
  validUntil: string;
}

export function createVisitor(input: CreateVisitorInput, idempotencyKey: string): Promise<VisitorResponse> {
  return apiFetch("/gatehouse/visitors", {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: input,
  });
}

export type DeliveryStatus = "PENDING" | "COLLECTED" | "RETURNED";

export interface DeliveryListItemResponse {
  id: string;
  unitId: string;
  condominiumId: string;
  residentId: string | null;
  description: string;
  carrier: string | null;
  courierName: string | null;
  trackingCode: string | null;
  volumeCount: number;
  status: DeliveryStatus;
  receiptPhotoId: string | null;
  pickupPhotoId: string | null;
  pickedUpBy: string | null;
  pickupDocument: string | null;
  pickupCodeLast4: string | null;
  pickupCredentialExpiresAt: string | null;
  receivedAt: string;
  collectedAt: string | null;
}

export interface DeliveryResponse extends DeliveryListItemResponse {
  pickupCode: string;
}

/** Código e QR em claro — só chegam aqui, uma única vez. */
export interface DeliveryCredentialResponse {
  delivery: DeliveryListItemResponse;
  pickupCode: string;
  qrToken: string;
  qrPayload: string;
  expiresAt: string | null;
}

export function listDeliveries(
  condominiumId: string,
  page: number,
  pageSize: number,
  status?: DeliveryStatus,
): Promise<Paginated<DeliveryListItemResponse>> {
  const statusParam = status ? `&status=${status}` : "";
  return apiFetch(`/gatehouse/deliveries?condominiumId=${condominiumId}&page=${page}&pageSize=${pageSize}${statusParam}`);
}

export interface CreateDeliveryInput {
  unitId: string;
  residentId?: string;
  description: string;
  carrier?: string;
  courierName?: string;
  trackingCode?: string;
  volumeCount?: number;
  receiptPhotoId?: string;
}

export function createDelivery(
  input: CreateDeliveryInput,
  idempotencyKey: string,
): Promise<DeliveryCredentialResponse> {
  return apiFetch("/gatehouse/deliveries", {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: input,
  });
}

export interface RedeemDeliveryInput {
  credential: string;
  pickedUpBy: string;
  pickupDocument?: string;
  pickupPhotoId?: string;
}

/** Retirada pelo código ditado ou pelo QR escaneado. */
export function redeemDelivery(input: RedeemDeliveryInput, idempotencyKey: string): Promise<DeliveryResponse> {
  return apiFetch("/gatehouse/deliveries/redeem", {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: input,
  });
}

export function reissuePickupCredential(
  deliveryId: string,
  idempotencyKey: string,
): Promise<DeliveryCredentialResponse> {
  return apiFetch(`/gatehouse/deliveries/${deliveryId}/credential`, {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
  });
}

export type KeyRecordStatus = "WITH_GATEHOUSE" | "CHECKED_OUT";

export interface KeyRecordResponse {
  id: string;
  unitId: string;
  condominiumId: string;
  label: string;
  status: KeyRecordStatus;
  checkedOutTo: string | null;
  checkedOutAt: string | null;
  returnedAt: string | null;
}

export function listKeyRecords(
  condominiumId: string,
  page: number,
  pageSize: number,
  status?: KeyRecordStatus,
): Promise<Paginated<KeyRecordResponse>> {
  const statusParam = status ? `&status=${status}` : "";
  return apiFetch(`/gatehouse/keys?condominiumId=${condominiumId}&page=${page}&pageSize=${pageSize}${statusParam}`);
}

export interface CreateKeyRecordInput {
  unitId: string;
  label: string;
}

export function createKeyRecord(input: CreateKeyRecordInput, idempotencyKey: string): Promise<KeyRecordResponse> {
  return apiFetch("/gatehouse/keys", {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: input,
  });
}

export function checkOutKey(
  keyRecordId: string,
  checkedOutTo: string,
  idempotencyKey: string,
): Promise<KeyRecordResponse> {
  return apiFetch(`/gatehouse/keys/${keyRecordId}/check-out`, {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: { checkedOutTo },
  });
}

export function returnKey(keyRecordId: string, idempotencyKey: string): Promise<KeyRecordResponse> {
  return apiFetch(`/gatehouse/keys/${keyRecordId}/return`, {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
  });
}
