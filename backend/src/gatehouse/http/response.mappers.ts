import type { Delivery, KeyRecord, OperationalPhoto, Visitor } from '@prisma/client';
import type { DeliveryWithCredential } from '../gatehouse.service';

export interface VisitorResponse {
  id: string;
  unitId: string;
  condominiumId: string;
  name: string;
  document: string | null;
  createdAt: string;
}

export function toVisitorResponse(v: Visitor): VisitorResponse {
  return {
    id: v.id,
    unitId: v.unitId,
    condominiumId: v.condominiumId,
    name: v.name,
    document: v.document,
    createdAt: v.createdAt.toISOString(),
  };
}

export interface DeliveryResponse {
  id: string;
  unitId: string;
  condominiumId: string;
  residentId: string | null;
  description: string;
  carrier: string | null;
  courierName: string | null;
  trackingCode: string | null;
  volumeCount: number;
  status: string;
  receiptPhotoId: string | null;
  pickupPhotoId: string | null;
  pickedUpBy: string | null;
  pickupDocument: string | null;
  pickupCodeLast4: string | null;
  pickupCredentialExpiresAt: string | null;
  receivedAt: string;
  collectedAt: string | null;
}

export function toDeliveryResponse(d: Delivery): DeliveryResponse {
  return {
    id: d.id,
    unitId: d.unitId,
    condominiumId: d.condominiumId,
    residentId: d.residentId,
    description: d.description,
    carrier: d.carrier,
    courierName: d.courierName,
    trackingCode: d.trackingCode,
    volumeCount: d.volumeCount,
    status: d.status,
    receiptPhotoId: d.receiptPhotoId,
    pickupPhotoId: d.pickupPhotoId,
    pickedUpBy: d.pickedUpBy,
    pickupDocument: d.pickupDocument,
    pickupCodeLast4: d.pickupCodeLast4,
    pickupCredentialExpiresAt: d.pickupCredentialExpires?.toISOString() ?? null,
    receivedAt: d.receivedAt.toISOString(),
    collectedAt: d.collectedAt?.toISOString() ?? null,
  };
}

/**
 * O código de retirada nunca aparece numa entrega já persistida: só o HMAC
 * fica no banco, e o valor em claro existe uma única vez, na resposta que
 * emite a credencial. `pickupCodeLast4` permanece para a portaria conferir
 * visualmente qual credencial o morador está citando, sem revelar o
 * suficiente para resgatá-la.
 */
export type DeliveryListItemResponse = DeliveryResponse;

export const toDeliveryListItemResponse = toDeliveryResponse;

/** Resposta de emissão da credencial: código e QR em claro, uma única vez. */
export interface DeliveryCredentialResponse {
  delivery: DeliveryListItemResponse;
  pickupCode: string;
  qrToken: string;
  qrPayload: string;
  expiresAt: string | null;
}

export function toDeliveryCredentialResponse(result: DeliveryWithCredential): DeliveryCredentialResponse {
  return {
    delivery: toDeliveryListItemResponse(result.delivery),
    pickupCode: result.pickupCode,
    qrToken: result.qrToken,
    qrPayload: result.qrPayload,
    expiresAt: result.expiresAt?.toISOString() ?? null,
  };
}

export interface OperationalPhotoResponse {
  id: string;
  condominiumId: string;
  category: string;
  source: string;
  contentType: string;
  sizeBytes: number;
  originalName: string | null;
  url: string;
  createdAt: string;
}

/** objectKey nunca sai daqui — o cliente busca os bytes pelo id. */
export function toOperationalPhotoResponse(p: OperationalPhoto): OperationalPhotoResponse {
  return {
    id: p.id,
    condominiumId: p.condominiumId,
    category: p.category,
    source: p.source,
    contentType: p.contentType,
    sizeBytes: p.sizeBytes,
    originalName: p.originalName,
    url: `/api/v1/gatehouse/photos/${p.id}/content`,
    createdAt: p.createdAt.toISOString(),
  };
}

export interface KeyRecordResponse {
  id: string;
  unitId: string;
  condominiumId: string;
  label: string;
  status: string;
  checkedOutTo: string | null;
  checkedOutAt: string | null;
  returnedAt: string | null;
}

export function toKeyRecordResponse(k: KeyRecord): KeyRecordResponse {
  return {
    id: k.id,
    unitId: k.unitId,
    condominiumId: k.condominiumId,
    label: k.label,
    status: k.status,
    checkedOutTo: k.checkedOutTo,
    checkedOutAt: k.checkedOutAt?.toISOString() ?? null,
    returnedAt: k.returnedAt?.toISOString() ?? null,
  };
}
