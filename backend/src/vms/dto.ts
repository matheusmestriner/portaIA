import { z } from 'zod';
import { AlarmEventType, SecurityLicenseFeature, VmsProvider } from '@prisma/client';
import { paginationQuerySchema } from '../common/http/pagination';

const optionalUrl = z.string().url().max(500).optional();

export const createVmsServerSchema = z.object({
  condominiumId: z.string().uuid(),
  name: z.string().min(1).max(150),
  provider: z.nativeEnum(VmsProvider).default(VmsProvider.GENERIC_ONVIF),
  endpoint: optionalUrl,
});
export type CreateVmsServerInput = z.input<typeof createVmsServerSchema>;

export const createCameraSchema = z.object({
  condominiumId: z.string().uuid(),
  vmsServerId: z.string().uuid().optional(),
  name: z.string().min(1).max(150),
  location: z.string().max(150).optional(),
  externalId: z.string().max(150).optional(),
});
export type CreateCameraInput = z.input<typeof createCameraSchema>;

export const createAlarmPanelSchema = z.object({
  condominiumId: z.string().uuid(),
  vmsServerId: z.string().uuid().optional(),
  name: z.string().min(1).max(150),
  provider: z.nativeEnum(VmsProvider).default(VmsProvider.OTHER),
  externalId: z.string().max(150).optional(),
});
export type CreateAlarmPanelInput = z.input<typeof createAlarmPanelSchema>;

export const createAlarmEventSchema = z.object({
  condominiumId: z.string().uuid(),
  alarmPanelId: z.string().uuid().optional(),
  cameraId: z.string().uuid().optional(),
  type: z.nativeEnum(AlarmEventType),
  message: z.string().min(1).max(2000),
  sourceEventId: z.string().max(150).optional(),
  occurredAt: z.coerce.date().optional(),
});
export type CreateAlarmEventInput = z.input<typeof createAlarmEventSchema>;

export const setSecurityLicenseSchema = z.object({
  condominiumId: z.string().uuid(),
  feature: z.nativeEnum(SecurityLicenseFeature),
  quantity: z.number().int().min(0).max(10000),
  expiresAt: z.coerce.date().optional().nullable(),
});
export type SetSecurityLicenseInput = z.input<typeof setSecurityLicenseSchema>;

export const vmsListQuerySchema = paginationQuerySchema;
