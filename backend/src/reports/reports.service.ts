import { Injectable } from '@nestjs/common';
import { DeliveryStatus, OccurrenceStatus, KeyRecordStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { resolveTenantScope } from '../auth/rbac/tenant-scope.resolver';
import type { Actor } from '../auth/actor';
import type { CondominiumReportQuery } from './dto';

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

export interface CountByGroup {
  total: number;
  byGroup: Record<string, number>;
}

export interface CallsReport {
  byStatus: CountByGroup;
  avgWaitSeconds: number | null;
  avgTalkSeconds: number | null;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(actor: Actor, condominiumId: string): Promise<OverviewReport> {
    const scope = resolveTenantScope(actor);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
      units,
      residents,
      vehicles,
      activeProviders,
      visitorsToday,
      pendingDeliveries,
      openOccurrences,
      keysCheckedOut,
      activePanicAlerts,
    ] = await this.prisma.withTenantContext(scope, (tx) =>
      Promise.all([
        tx.unit.count({ where: { condominiumId } }),
        tx.resident.count({ where: { condominiumId } }),
        tx.vehicle.count({ where: { condominiumId } }),
        tx.provider.count({ where: { condominiumId, isActive: true } }),
        tx.visitor.count({ where: { condominiumId, createdAt: { gte: startOfToday } } }),
        tx.delivery.count({ where: { condominiumId, status: DeliveryStatus.PENDING } }),
        tx.occurrence.count({ where: { condominiumId, status: { not: OccurrenceStatus.CLOSED } } }),
        tx.keyRecord.count({ where: { condominiumId, status: KeyRecordStatus.CHECKED_OUT } }),
        tx.panicAlert.count({ where: { condominiumId, resolvedAt: null } }),
      ]),
    );

    return {
      units,
      residents,
      vehicles,
      activeProviders,
      visitorsToday,
      pendingDeliveries,
      openOccurrences,
      keysCheckedOut,
      activePanicAlerts,
    };
  }

  async deliveriesByStatus(actor: Actor, query: CondominiumReportQuery): Promise<CountByGroup> {
    const scope = resolveTenantScope(actor);
    const rows = await this.prisma.withTenantContext(scope, (tx) =>
      tx.delivery.groupBy({
        by: ['status'],
        where: { condominiumId: query.condominiumId, ...this.dateRange(query) },
        _count: true,
      }),
    );
    return this.toCountByGroup(rows, (r) => r.status);
  }

  async occurrencesBySeverity(actor: Actor, query: CondominiumReportQuery): Promise<CountByGroup> {
    const scope = resolveTenantScope(actor);
    const rows = await this.prisma.withTenantContext(scope, (tx) =>
      tx.occurrence.groupBy({
        by: ['severity'],
        where: { condominiumId: query.condominiumId, ...this.dateRange(query) },
        _count: true,
      }),
    );
    return this.toCountByGroup(rows, (r) => r.severity);
  }

  async visitorAuthorizationsByStatus(actor: Actor, query: CondominiumReportQuery): Promise<CountByGroup> {
    const scope = resolveTenantScope(actor);
    const rows = await this.prisma.withTenantContext(scope, (tx) =>
      tx.visitorAuthorization.groupBy({
        by: ['status'],
        where: { condominiumId: query.condominiumId, ...this.dateRange(query) },
        _count: true,
      }),
    );
    return this.toCountByGroup(rows, (r) => r.status);
  }

  async callsReport(actor: Actor, query: CondominiumReportQuery): Promise<CallsReport> {
    const scope = resolveTenantScope(actor);
    const where = { condominiumId: query.condominiumId, ...this.dateRange(query) };

    const [statusRows, timedCalls] = await this.prisma.withTenantContext(scope, (tx) =>
      Promise.all([
        tx.call.groupBy({ by: ['status'], where, _count: true }),
        tx.call.findMany({
          where,
          select: { queuedAt: true, ringingAt: true, answeredAt: true, endedAt: true },
        }),
      ]),
    );

    const waitSeconds: number[] = [];
    const talkSeconds: number[] = [];
    for (const call of timedCalls) {
      if (call.queuedAt && call.ringingAt) {
        waitSeconds.push((call.ringingAt.getTime() - call.queuedAt.getTime()) / 1000);
      }
      if (call.answeredAt && call.endedAt) {
        talkSeconds.push((call.endedAt.getTime() - call.answeredAt.getTime()) / 1000);
      }
    }

    return {
      byStatus: this.toCountByGroup(statusRows, (r) => r.status),
      avgWaitSeconds: average(waitSeconds),
      avgTalkSeconds: average(talkSeconds),
    };
  }

  async activeProvidersCount(actor: Actor, condominiumId: string): Promise<CountByGroup> {
    const scope = resolveTenantScope(actor);
    const [active, inactive] = await this.prisma.withTenantContext(scope, (tx) =>
      Promise.all([
        tx.provider.count({ where: { condominiumId, isActive: true } }),
        tx.provider.count({ where: { condominiumId, isActive: false } }),
      ]),
    );
    return { total: active + inactive, byGroup: { active: active, inactive: inactive } };
  }

  private dateRange(query: CondominiumReportQuery): { createdAt?: { gte?: Date; lte?: Date } } {
    if (!query.from && !query.to) return {};
    return { createdAt: { ...(query.from ? { gte: query.from } : {}), ...(query.to ? { lte: query.to } : {}) } };
  }

  private toCountByGroup<T>(rows: T[], keyOf: (row: T) => string): CountByGroup {
    const byGroup: Record<string, number> = {};
    let total = 0;
    for (const row of rows) {
      const count = (row as unknown as { _count: number })._count;
      byGroup[keyOf(row)] = count;
      total += count;
    }
    return { total, byGroup };
  }
}
