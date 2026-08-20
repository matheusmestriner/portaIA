import { apiFetch } from "./client";

export interface OverviewReport {
  units: number;
  residents: number;
  vehicles: number;
  activeProviders: number;
  visitorsToday: number;
  pendingDeliveries: number;
  openOccurrences: number;
  keysCheckedOut: number;
  activePanicAlerts: number;
}

export function getOverview(condominiumId: string): Promise<OverviewReport> {
  return apiFetch(`/reports/overview?condominiumId=${condominiumId}`);
}

export interface CountByGroup {
  total: number;
  byGroup: Record<string, number>;
}

export function getDeliveriesByStatus(condominiumId: string): Promise<CountByGroup> {
  return apiFetch(`/reports/deliveries?condominiumId=${condominiumId}`);
}
