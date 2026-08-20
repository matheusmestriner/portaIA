import type { Announcement, NotificationOutboxEntry } from '@prisma/client';

export interface AnnouncementResponse {
  id: string;
  condominiumId: string;
  title: string;
  body: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export function toAnnouncementResponse(a: Announcement): AnnouncementResponse {
  return {
    id: a.id,
    condominiumId: a.condominiumId,
    title: a.title,
    body: a.body,
    createdBy: a.createdBy,
    createdAt: a.createdAt.toISOString(),
    // Um comunicado pode ser editado depois de publicado; sem este campo o
    // cliente não tem como saber que a versão que ele tem em cache ficou velha.
    updatedAt: a.updatedAt.toISOString(),
  };
}

export interface OutboxEntryResponse {
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

export function toOutboxEntryResponse(e: NotificationOutboxEntry): OutboxEntryResponse {
  return {
    id: e.id,
    condominiumId: e.condominiumId,
    announcementId: e.announcementId,
    channel: e.channel,
    recipient: e.recipient,
    status: e.status,
    error: e.error,
    attemptedAt: e.attemptedAt?.toISOString() ?? null,
    createdAt: e.createdAt.toISOString(),
  };
}
