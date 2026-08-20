import { apiFetch } from "./client";
import type { Paginated } from "./types";

export interface Announcement {
  id: string;
  condominiumId: string;
  title: string;
  body: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface OutboxEntry {
  id: string;
  condominiumId: string;
  announcementId: string | null;
  channel: string;
  recipient: string;
  status: string;
  error: string | null;
  attemptedAt: string | null;
  createdAt: string;
}

export interface Extension {
  id: string;
  unitId: string;
  condominiumId: string;
  number: string;
  sipUsername: string;
  isActive: boolean;
  createdAt: string;
}

export interface Call {
  id: string;
  condominiumId: string;
  externalCallId: string | null;
  callerType: string;
  calleeType: string;
  status: string;
  queuedAt: string | null;
  answeredAt: string | null;
  endedAt: string | null;
  endReason: string | null;
  createdAt: string;
}

export interface WhatsAppStatus {
  connected: boolean;
  reason?: string;
}

function query(condominiumId: string, pageSize = 8): string {
  return `condominiumId=${encodeURIComponent(condominiumId)}&page=1&pageSize=${pageSize}`;
}

export function getWhatsAppStatus(): Promise<WhatsAppStatus> {
  return apiFetch("/notifications/whatsapp/status");
}

export function listAnnouncements(condominiumId: string): Promise<Paginated<Announcement>> {
  return apiFetch(`/notifications/announcements?${query(condominiumId)}`);
}

export function listOutboxEntries(condominiumId: string): Promise<Paginated<OutboxEntry>> {
  return apiFetch(`/notifications/outbox?${query(condominiumId)}`);
}

export function listExtensions(condominiumId: string): Promise<Paginated<Extension>> {
  return apiFetch(`/telephony/extensions?${query(condominiumId)}`);
}

export function listCalls(condominiumId: string): Promise<Paginated<Call>> {
  return apiFetch(`/telephony/calls?${query(condominiumId)}`);
}
