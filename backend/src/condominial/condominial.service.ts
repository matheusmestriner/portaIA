import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { type Provider, type Resident, type Unit, type Vehicle } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { auditedOperation } from '../common/audit/audited-operation';
import { paginate, type PaginationQuery, type Paginated } from '../common/http/pagination';
import { PERMISSIONS, roleHasPermission } from '../auth/rbac/permissions';
import { resolveTenantScope } from '../auth/rbac/tenant-scope.resolver';
import { PasswordHasherService } from '../auth/password-hasher.service';
import { generateSipPassword } from '../telephony/sip-credential.crypto';
import type { Actor } from '../auth/actor';

export interface CreatedResident {
  resident: Resident;
  /** Senha temporária em claro, devolvida uma única vez — nunca persistida nem recuperável depois (mesmo padrão de sipPassword em ExtensionsService e do código/QR de retirada). Null quando o morador não tem email (login ainda não é possível sem um identificador único). */
  temporaryPassword: string | null;
}
import {
  createProviderSchema,
  createResidentSchema,
  createUnitSchema,
  createVehicleSchema,
  type CreateProviderInput,
  type CreateResidentInput,
  type CreateUnitInput,
  type CreateVehicleInput,
} from './dto';

@Injectable()
export class CondominialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly passwordHasher: PasswordHasherService,
  ) {}

  async createUnit(actor: Actor, input: CreateUnitInput): Promise<Unit> {
    this.assertCanManage(actor);
    const data = createUnitSchema.parse(input);
    const scope = resolveTenantScope(actor);

    return auditedOperation(this.audit, actor, scope, 'unit.create', 'Unit', async () => {
      const condominium = await this.prisma.withTenantContext(scope, (tx) =>
        tx.condominium.findUniqueOrThrow({ where: { id: data.condominiumId } }),
      );
      return this.prisma.withTenantContext(scope, (tx) =>
        tx.unit.create({
          data: {
            condominiumId: condominium.id,
            identifier: data.identifier,
            block: data.block,
            floor: data.floor,
            resaleId: condominium.resaleId,
            clientId: condominium.clientId,
          },
        }),
      );
    });
  }

  async listUnits(actor: Actor, condominiumId: string, query: PaginationQuery): Promise<Paginated<Unit>> {
    this.assertCanListUnits(actor);
    const scope = resolveTenantScope(actor);
    const [items, total] = await this.prisma.withTenantContext(scope, (tx) =>
      Promise.all([
        tx.unit.findMany({
          where: { condominiumId },
          orderBy: { identifier: 'asc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        tx.unit.count({ where: { condominiumId } }),
      ]),
    );
    return paginate(items, total, query);
  }

  async createResident(actor: Actor, input: CreateResidentInput): Promise<CreatedResident> {
    this.assertCanManage(actor);
    const data = createResidentSchema.parse(input);
    const scope = resolveTenantScope(actor);

    // Login do app do morador só é possível com email (é o identificador
    // único de login — ver resident-auth). Sem email, o morador ainda é
    // cadastrado normalmente (uso operacional continua funcionando hoje),
    // só não ganha uma senha ainda.
    const temporaryPassword = data.email ? generateSipPassword() : null;
    const passwordHash = temporaryPassword ? await this.passwordHasher.hash(temporaryPassword) : null;

    return auditedOperation(
      this.audit,
      actor,
      scope,
      'resident.create',
      'Resident',
      async () => {
        const unit = await this.prisma.withTenantContext(scope, (tx) =>
          tx.unit.findUniqueOrThrow({ where: { id: data.unitId } }),
        );
        const resident = await this.prisma.withTenantContext(scope, (tx) =>
          tx.resident.create({
            data: {
              unitId: unit.id,
              name: data.name,
              email: data.email,
              phone: data.phone,
              isPrimary: data.isPrimary,
              resaleId: unit.resaleId,
              clientId: unit.clientId,
              condominiumId: unit.condominiumId,
              ...(passwordHash ? { passwordHash, mustChangePassword: true } : {}),
            },
          }),
        );
        return { resident, temporaryPassword };
      },
      (result) => result.resident.id,
    );
  }

  /**
   * Filtra por unidade OU por condomínio inteiro. A portaria precisa da lista
   * do condomínio (para escolher o destinatário de uma entrega, por exemplo),
   * enquanto a tela de uma unidade específica filtra por ela.
   */
  async listResidents(
    actor: Actor,
    filter: { unitId?: string; condominiumId?: string },
    query: PaginationQuery,
  ): Promise<Paginated<Resident>> {
    this.assertCanListUnits(actor);
    if (!filter.unitId && !filter.condominiumId) {
      throw new BadRequestException('Informe unitId ou condominiumId');
    }
    const scope = resolveTenantScope(actor);
    const where = {
      ...(filter.unitId ? { unitId: filter.unitId } : {}),
      ...(filter.condominiumId ? { condominiumId: filter.condominiumId } : {}),
    };
    const [items, total] = await this.prisma.withTenantContext(scope, (tx) =>
      Promise.all([
        tx.resident.findMany({
          where,
          orderBy: { name: 'asc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        tx.resident.count({ where }),
      ]),
    );
    return paginate(items, total, query);
  }

  async createVehicle(actor: Actor, input: CreateVehicleInput): Promise<Vehicle> {
    this.assertCanManage(actor);
    const data = createVehicleSchema.parse(input);
    const scope = resolveTenantScope(actor);

    return auditedOperation(this.audit, actor, scope, 'vehicle.create', 'Vehicle', async () => {
      const unit = await this.prisma.withTenantContext(scope, (tx) =>
        tx.unit.findUniqueOrThrow({ where: { id: data.unitId } }),
      );
      return this.prisma.withTenantContext(scope, (tx) =>
        tx.vehicle.create({
          data: {
            unitId: unit.id,
            plate: data.plate,
            model: data.model,
            color: data.color,
            resaleId: unit.resaleId,
            clientId: unit.clientId,
            condominiumId: unit.condominiumId,
          },
        }),
      );
    });
  }

  async listVehicles(actor: Actor, condominiumId: string, query: PaginationQuery): Promise<Paginated<Vehicle>> {
    const scope = resolveTenantScope(actor);
    const [items, total] = await this.prisma.withTenantContext(scope, (tx) =>
      Promise.all([
        tx.vehicle.findMany({
          where: { condominiumId },
          orderBy: { plate: 'asc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        tx.vehicle.count({ where: { condominiumId } }),
      ]),
    );
    return paginate(items, total, query);
  }

  async createProvider(actor: Actor, input: CreateProviderInput): Promise<Provider> {
    this.assertCanManage(actor);
    const data = createProviderSchema.parse(input);
    const scope = resolveTenantScope(actor);

    return auditedOperation(this.audit, actor, scope, 'provider.create', 'Provider', async () => {
      const condominium = await this.prisma.withTenantContext(scope, (tx) =>
        tx.condominium.findUniqueOrThrow({ where: { id: data.condominiumId } }),
      );
      return this.prisma.withTenantContext(scope, (tx) =>
        tx.provider.create({
          data: {
            condominiumId: condominium.id,
            name: data.name,
            document: data.document,
            company: data.company,
            resaleId: condominium.resaleId,
            clientId: condominium.clientId,
          },
        }),
      );
    });
  }

  async listProviders(actor: Actor, condominiumId: string, query: PaginationQuery): Promise<Paginated<Provider>> {
    const scope = resolveTenantScope(actor);
    const [items, total] = await this.prisma.withTenantContext(scope, (tx) =>
      Promise.all([
        tx.provider.findMany({
          where: { condominiumId },
          orderBy: { name: 'asc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        tx.provider.count({ where: { condominiumId } }),
      ]),
    );
    return paginate(items, total, query);
  }

  private assertCanManage(actor: Actor): void {
    if (!roleHasPermission(actor.role, PERMISSIONS.CONDOMINIUM_MANAGE)) {
      throw new ForbiddenException('Papel sem permissão para gerenciar dados condominiais');
    }
  }

  /**
   * Wider than assertCanManage on purpose: looking up units is a prerequisite
   * for almost every condo-level write elsewhere (gatehouse, security,
   * telephony all need a unit picker), so any operate-level permission at
   * the condo tier — not just CONDOMINIUM_MANAGE or REPORTS_VIEW — should be
   * enough to list them.
   */
  private assertCanListUnits(actor: Actor): void {
    const allowed = [
      PERMISSIONS.REPORTS_VIEW,
      PERMISSIONS.CONDOMINIUM_MANAGE,
      PERMISSIONS.GATEHOUSE_OPERATE,
      PERMISSIONS.SECURITY_OPERATE,
      PERMISSIONS.TELEPHONY_OPERATE,
    ];
    if (!allowed.some((permission) => roleHasPermission(actor.role, permission))) {
      throw new ForbiddenException('Papel sem permissão para listar unidades');
    }
  }

}
