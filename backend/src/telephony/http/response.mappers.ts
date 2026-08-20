import type { Call, Extension, Recording } from '@prisma/client';

export interface ExtensionResponse {
  id: string;
  unitId: string;
  condominiumId: string;
  number: string;
  sipUsername: string;
  isActive: boolean;
  createdAt: string;
}

/** sipPasswordEncrypted never leaves this function. */
export function toExtensionResponse(e: Extension): ExtensionResponse {
  return {
    id: e.id,
    unitId: e.unitId,
    condominiumId: e.condominiumId,
    number: e.number,
    sipUsername: e.sipUsername,
    isActive: e.isActive,
    createdAt: e.createdAt.toISOString(),
  };
}

export interface CallResponse {
  id: string;
  condominiumId: string;
  externalCallId: string | null;
  callerType: string;
  callerExtensionId: string | null;
  calleeType: string;
  calleeExtensionId: string | null;
  status: string;
  queuedAt: string | null;
  ringingAt: string | null;
  answeredAt: string | null;
  endedAt: string | null;
  endReason: string | null;
  createdAt: string;
}

export function toCallResponse(c: Call): CallResponse {
  return {
    id: c.id,
    condominiumId: c.condominiumId,
    externalCallId: c.externalCallId,
    callerType: c.callerType,
    callerExtensionId: c.callerExtensionId,
    calleeType: c.calleeType,
    calleeExtensionId: c.calleeExtensionId,
    status: c.status,
    queuedAt: c.queuedAt?.toISOString() ?? null,
    ringingAt: c.ringingAt?.toISOString() ?? null,
    answeredAt: c.answeredAt?.toISOString() ?? null,
    endedAt: c.endedAt?.toISOString() ?? null,
    endReason: c.endReason,
    createdAt: c.createdAt.toISOString(),
  };
}

export interface RecordingResponse {
  id: string;
  condominiumId: string;
  callId: string;
  storageKey: string;
  checksum: string;
  sizeBytes: number;
  durationSeconds: number;
  retentionUntil: string | null;
  createdAt: string;
}

export function toRecordingResponse(r: Recording): RecordingResponse {
  return {
    id: r.id,
    condominiumId: r.condominiumId,
    callId: r.callId,
    storageKey: r.storageKey,
    checksum: r.checksum,
    sizeBytes: r.sizeBytes,
    durationSeconds: r.durationSeconds,
    retentionUntil: r.retentionUntil?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  };
}
