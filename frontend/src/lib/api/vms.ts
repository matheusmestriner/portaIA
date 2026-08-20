import { apiFetch } from "./client";
import type { Paginated } from "./types";

export type VmsProvider = "GENERIC_ONVIF" | "HIKVISION" | "DAHUA" | "INTELBRAS" | "MILESTONE" | "GENETEC" | "OTHER";

export interface VmsServer { id: string; name: string; provider: VmsProvider; endpoint: string | null; connectionStatus: string; lastCheckedAt: string | null; }
export interface Camera { id: string; vmsServerId: string | null; name: string; location: string | null; status: string; isActive: boolean; lastSeenAt: string | null; }
export interface AlarmPanel { id: string; vmsServerId: string | null; name: string; provider: VmsProvider; status: string; lastSeenAt: string | null; }
export interface AlarmEvent { id: string; alarmPanelId: string | null; cameraId: string | null; type: string; status: string; message: string; occurredAt: string; }
export interface SecurityLicense { id: string; feature: string; quantity: number; expiresAt: string | null; }

const listPath = (path: string, condominiumId: string) => `${path}?condominiumId=${encodeURIComponent(condominiumId)}&page=1&pageSize=50`;
const mutationHeaders = () => ({ "Idempotency-Key": crypto.randomUUID() });

export const listVmsServers = (condominiumId: string) => apiFetch<Paginated<VmsServer>>(listPath("/vms/servers", condominiumId));
export const listCameras = (condominiumId: string) => apiFetch<Paginated<Camera>>(listPath("/vms/cameras", condominiumId));
export const listAlarmPanels = (condominiumId: string) => apiFetch<Paginated<AlarmPanel>>(listPath("/vms/alarm-panels", condominiumId));
export const listAlarmEvents = (condominiumId: string) => apiFetch<Paginated<AlarmEvent>>(listPath("/vms/alarm-events", condominiumId));
export const listSecurityLicenses = (condominiumId: string) => apiFetch<Paginated<SecurityLicense>>(listPath("/vms/licenses", condominiumId));

export const createVmsServer = (body: { condominiumId: string; name: string; provider: VmsProvider; endpoint?: string }) => apiFetch<VmsServer>("/vms/servers", { method: "POST", body, headers: mutationHeaders() });
export const createCamera = (body: { condominiumId: string; name: string; location?: string; vmsServerId?: string }) => apiFetch<Camera>("/vms/cameras", { method: "POST", body, headers: mutationHeaders() });
export const createAlarmPanel = (body: { condominiumId: string; name: string; provider: VmsProvider; vmsServerId?: string }) => apiFetch<AlarmPanel>("/vms/alarm-panels", { method: "POST", body, headers: mutationHeaders() });
export const createAlarmEvent = (body: { condominiumId: string; type: string; message: string; alarmPanelId?: string; cameraId?: string }) => apiFetch<AlarmEvent>("/vms/alarm-events", { method: "POST", body, headers: mutationHeaders() });
