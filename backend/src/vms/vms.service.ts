import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { type AlarmEvent, type AlarmPanel, type Camera, type SecurityLicense, type VmsServer } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { auditedOperation } from '../common/audit/audited-operation';
import { PERMISSIONS, roleHasPermission } from '../auth/rbac/permissions';
import { resolveTenantScope } from '../auth/rbac/tenant-scope.resolver';
import { paginate, type Paginated, type PaginationQuery } from '../common/http/pagination';
import type { Actor } from '../auth/actor';
import { createAlarmEventSchema, createAlarmPanelSchema, createCameraSchema, createVmsServerSchema, setSecurityLicenseSchema, type CreateAlarmEventInput, type CreateAlarmPanelInput, type CreateCameraInput, type CreateVmsServerInput, type SetSecurityLicenseInput } from './dto';

@Injectable()
export class VmsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async createServer(actor: Actor, input: CreateVmsServerInput): Promise<VmsServer> {
    this.assertOperate(actor);
    const data = createVmsServerSchema.parse(input);
    const scope = resolveTenantScope(actor);
    return auditedOperation(this.audit, actor, scope, 'vms_server.create', 'VmsServer', () => this.prisma.withTenantContext(scope, async (tx) => {
      const condominium = await tx.condominium.findUniqueOrThrow({ where: { id: data.condominiumId } });
      return tx.vmsServer.create({ data: { ...data, condominiumId: condominium.id, resaleId: condominium.resaleId, clientId: condominium.clientId } });
    }));
  }

  async createCamera(actor: Actor, input: CreateCameraInput): Promise<Camera> {
    this.assertOperate(actor);
    const data = createCameraSchema.parse(input);
    const scope = resolveTenantScope(actor);
    return auditedOperation(this.audit, actor, scope, 'camera.create', 'Camera', () => this.prisma.withTenantContext(scope, async (tx) => {
      const condominium = await tx.condominium.findUniqueOrThrow({ where: { id: data.condominiumId } });
      if (data.vmsServerId) {
        const server = await tx.vmsServer.findUniqueOrThrow({ where: { id: data.vmsServerId } });
        if (server.condominiumId !== condominium.id) throw new BadRequestException('A central VMS não pertence ao condomínio informado');
      }
      return tx.camera.create({ data: { ...data, condominiumId: condominium.id, resaleId: condominium.resaleId, clientId: condominium.clientId } });
    }));
  }

  async createAlarmPanel(actor: Actor, input: CreateAlarmPanelInput): Promise<AlarmPanel> {
    this.assertOperate(actor);
    const data = createAlarmPanelSchema.parse(input);
    const scope = resolveTenantScope(actor);
    return auditedOperation(this.audit, actor, scope, 'alarm_panel.create', 'AlarmPanel', () => this.prisma.withTenantContext(scope, async (tx) => {
      const condominium = await tx.condominium.findUniqueOrThrow({ where: { id: data.condominiumId } });
      if (data.vmsServerId) {
        const server = await tx.vmsServer.findUniqueOrThrow({ where: { id: data.vmsServerId } });
        if (server.condominiumId !== condominium.id) throw new BadRequestException('A central VMS não pertence ao condomínio informado');
      }
      return tx.alarmPanel.create({ data: { ...data, condominiumId: condominium.id, resaleId: condominium.resaleId, clientId: condominium.clientId } });
    }));
  }

  async createAlarmEvent(actor: Actor, input: CreateAlarmEventInput): Promise<AlarmEvent> {
    this.assertOperate(actor);
    const data = createAlarmEventSchema.parse(input);
    const scope = resolveTenantScope(actor);
    return auditedOperation(this.audit, actor, scope, 'alarm_event.create', 'AlarmEvent', () => this.prisma.withTenantContext(scope, async (tx) => {
      const condominium = await tx.condominium.findUniqueOrThrow({ where: { id: data.condominiumId } });
      const [panel, camera] = await Promise.all([data.alarmPanelId ? tx.alarmPanel.findUniqueOrThrow({ where: { id: data.alarmPanelId } }) : null, data.cameraId ? tx.camera.findUniqueOrThrow({ where: { id: data.cameraId } }) : null]);
      if (panel && panel.condominiumId !== condominium.id) throw new BadRequestException('A central de alarme não pertence ao condomínio informado');
      if (camera && camera.condominiumId !== condominium.id) throw new BadRequestException('A câmera não pertence ao condomínio informado');
      return tx.alarmEvent.create({ data: { ...data, condominiumId: condominium.id, resaleId: condominium.resaleId, clientId: condominium.clientId } });
    }));
  }

  async setLicense(actor: Actor, input: SetSecurityLicenseInput): Promise<SecurityLicense> {
    if (!roleHasPermission(actor.role, PERMISSIONS.PLATFORM_MANAGE)) throw new ForbiddenException('Papel sem permissão para licenciar recursos de segurança');
    const data = setSecurityLicenseSchema.parse(input);
    const scope = resolveTenantScope(actor);
    return auditedOperation(this.audit, actor, scope, 'security_license.set', 'SecurityLicense', () => this.prisma.withTenantContext(scope, async (tx) => {
      const condominium = await tx.condominium.findUniqueOrThrow({ where: { id: data.condominiumId } });
      return tx.securityLicense.upsert({ where: { condominiumId_feature: { condominiumId: condominium.id, feature: data.feature } }, create: { ...data, condominiumId: condominium.id, resaleId: condominium.resaleId, clientId: condominium.clientId }, update: { quantity: data.quantity, expiresAt: data.expiresAt } });
    }));
  }

  async listServers(actor: Actor, condominiumId: string, query: PaginationQuery): Promise<Paginated<VmsServer>> { return this.list(actor, condominiumId, query, 'vmsServer'); }
  async listCameras(actor: Actor, condominiumId: string, query: PaginationQuery): Promise<Paginated<Camera>> { return this.list(actor, condominiumId, query, 'camera'); }
  async listAlarmPanels(actor: Actor, condominiumId: string, query: PaginationQuery): Promise<Paginated<AlarmPanel>> { return this.list(actor, condominiumId, query, 'alarmPanel'); }
  async listAlarmEvents(actor: Actor, condominiumId: string, query: PaginationQuery): Promise<Paginated<AlarmEvent>> { return this.list(actor, condominiumId, query, 'alarmEvent', { occurredAt: 'desc' }); }
  async listLicenses(actor: Actor, condominiumId: string, query: PaginationQuery): Promise<Paginated<SecurityLicense>> { return this.list(actor, condominiumId, query, 'securityLicense'); }

  private async list<T>(actor: Actor, condominiumId: string, query: PaginationQuery, delegate: 'vmsServer' | 'camera' | 'alarmPanel' | 'alarmEvent' | 'securityLicense', orderBy: object = { createdAt: 'desc' }): Promise<Paginated<T>> {
    this.assertView(actor);
    const scope = resolveTenantScope(actor);
    return this.prisma.withTenantContext(scope, async (tx) => {
      const repository = tx[delegate] as unknown as { findMany(args: object): Promise<T[]>; count(args: object): Promise<number> };
      const [items, total] = await Promise.all([repository.findMany({ where: { condominiumId }, orderBy, skip: (query.page - 1) * query.pageSize, take: query.pageSize }), repository.count({ where: { condominiumId } })]);
      return paginate(items, total, query);
    });
  }

  private assertView(actor: Actor): void { if (!roleHasPermission(actor.role, PERMISSIONS.REPORTS_VIEW)) throw new ForbiddenException('Papel sem permissão para consultar monitoramento'); }
  private assertOperate(actor: Actor): void { if (!roleHasPermission(actor.role, PERMISSIONS.SECURITY_OPERATE)) throw new ForbiddenException('Papel sem permissão para operar monitoramento'); }
}
