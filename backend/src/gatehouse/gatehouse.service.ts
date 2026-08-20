import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeliveryStatus,
  KeyRecordStatus,
  VisitorAuthorizationStatus,
  type Delivery,
  type KeyRecord,
  type Visitor,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { auditedOperation } from '../common/audit/audited-operation';
import { PERMISSIONS, roleHasPermission } from '../auth/rbac/permissions';
import { resolveTenantScope } from '../auth/rbac/tenant-scope.resolver';
import { paginate, type PaginationQuery, type Paginated } from '../common/http/pagination';
import type { Actor } from '../auth/actor';
import type { EnvConfig } from '../config/env.schema';
import { DeliveryNotificationsService } from './delivery-notifications.service';
import {
  buildQrPayload,
  credentialHash,
  extractCredential,
  generatePickupCode,
  generateQrToken,
} from './pickup-credential';
import {
  checkOutKeySchema,
  createDeliverySchema,
  createKeyRecordSchema,
  createVisitorSchema,
  redeemDeliverySchema,
  type CheckOutKeyInput,
  type CreateDeliveryInput,
  type CreateKeyRecordInput,
  type CreateVisitorInput,
  type RedeemDeliveryInput,
} from './dto';

/** A credencial em claro só existe nesta resposta — no banco fica só o HMAC. */
export interface DeliveryWithCredential {
  delivery: Delivery;
  pickupCode: string;
  qrToken: string;
  qrPayload: string;
  expiresAt: Date | null;
}

@Injectable()
export class GatehouseService {
  private readonly logger = new Logger(GatehouseService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService<EnvConfig, true>,
    private readonly notifications: DeliveryNotificationsService,
  ) {}

  async registerVisitor(actor: Actor, input: CreateVisitorInput): Promise<Visitor> {
    this.assertCanOperate(actor);
    const data = createVisitorSchema.parse(input);
    if (data.validUntil <= data.validFrom) {
      throw new BadRequestException('validUntil deve ser depois de validFrom');
    }
    const scope = resolveTenantScope(actor);

    return auditedOperation(this.audit, actor, scope, 'visitor.register', 'Visitor', async () => {
      const unit = await this.prisma.withTenantContext(scope, (tx) =>
        tx.unit.findUniqueOrThrow({ where: { id: data.unitId } }),
      );
      return this.prisma.withTenantContext(scope, async (tx) => {
        const visitor = await tx.visitor.create({
          data: {
            unitId: unit.id,
            name: data.name,
            document: data.document,
            resaleId: unit.resaleId,
            clientId: unit.clientId,
            condominiumId: unit.condominiumId,
          },
        });
        await tx.visitorAuthorization.create({
          data: {
            visitorId: visitor.id,
            status: VisitorAuthorizationStatus.APPROVED,
            validFrom: data.validFrom,
            validUntil: data.validUntil,
            resaleId: unit.resaleId,
            clientId: unit.clientId,
            condominiumId: unit.condominiumId,
          },
        });
        return visitor;
      });
    });
  }

  async listVisitors(actor: Actor, condominiumId: string, query: PaginationQuery): Promise<Paginated<Visitor>> {
    this.assertCanOperate(actor);
    const scope = resolveTenantScope(actor);
    const [items, total] = await this.prisma.withTenantContext(scope, (tx) =>
      Promise.all([
        tx.visitor.findMany({
          where: { condominiumId },
          orderBy: { createdAt: 'desc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        tx.visitor.count({ where: { condominiumId } }),
      ]),
    );
    return paginate(items, total, query);
  }

  /**
   * Registra o recebimento e já emite a credencial de retirada: o código de 6
   * dígitos vai para o WhatsApp do morador destinatário (quando houver
   * telefone e a ponte estiver configurada) e o token do QR fica pronto para
   * o app do morador exibir. Os valores em claro voltam UMA única vez, nesta
   * resposta — no banco só ficam os HMACs.
   */
  async createDelivery(actor: Actor, input: CreateDeliveryInput): Promise<DeliveryWithCredential> {
    this.assertCanOperate(actor);
    const data = createDeliverySchema.parse(input);
    const scope = resolveTenantScope(actor);

    const pickupCode = generatePickupCode();
    const qrToken = generateQrToken();
    const secret = this.config.get('PICKUP_CREDENTIAL_SECRET', { infer: true });
    const ttlHours = this.config.get('PICKUP_CREDENTIAL_TTL_HOURS', { infer: true });

    const delivery = await auditedOperation(this.audit, actor, scope, 'delivery.create', 'Delivery', async () => {
      const unit = await this.prisma.withTenantContext(scope, (tx) =>
        tx.unit.findUniqueOrThrow({ where: { id: data.unitId } }),
      );
      return this.prisma.withTenantContext(scope, async (tx) => {
        if (data.residentId) {
          const resident = await tx.resident.findUniqueOrThrow({ where: { id: data.residentId } });
          if (resident.unitId !== unit.id) {
            throw new BadRequestException('O morador informado não pertence à unidade da entrega');
          }
        }
        return tx.delivery.create({
          data: {
            unitId: unit.id,
            residentId: data.residentId ?? null,
            description: data.description,
            carrier: data.carrier ?? null,
            courierName: data.courierName ?? null,
            trackingCode: data.trackingCode ?? null,
            volumeCount: data.volumeCount,
            receiptPhotoId: data.receiptPhotoId ?? null,
            pickupCodeHash: credentialHash(pickupCode, secret),
            pickupCodeLast4: pickupCode.slice(-4),
            pickupQrHash: credentialHash(qrToken, secret),
            pickupCredentialExpires: new Date(Date.now() + ttlHours * 3600_000),
            resaleId: unit.resaleId,
            clientId: unit.clientId,
            condominiumId: unit.condominiumId,
          },
        });
      });
    });

    await this.notifyPickupCode(scope, delivery, pickupCode);

    return {
      delivery,
      pickupCode,
      qrToken,
      qrPayload: buildQrPayload(delivery.id, qrToken),
      expiresAt: delivery.pickupCredentialExpires,
    };
  }

  /**
   * Retirada por credencial: a portaria apresenta o código ditado pelo morador
   * ou o conteúdo do QR escaneado, e o backend localiza a entrega pelo HMAC.
   * A busca é escopada por RLS, então uma credencial de outro condomínio
   * simplesmente não é encontrada.
   */
  async redeemDelivery(actor: Actor, input: RedeemDeliveryInput): Promise<Delivery> {
    this.assertCanOperate(actor);
    const data = redeemDeliverySchema.parse(input);
    const scope = resolveTenantScope(actor);
    const secret = this.config.get('PICKUP_CREDENTIAL_SECRET', { infer: true });
    const digest = credentialHash(extractCredential(data.credential), secret);

    return auditedOperation(this.audit, actor, scope, 'delivery.redeem', 'Delivery', () =>
      this.prisma.withTenantContext(scope, async (tx) => {
        const delivery = await tx.delivery.findFirst({
          where: { OR: [{ pickupCodeHash: digest }, { pickupQrHash: digest }] },
        });
        if (!delivery) {
          throw new NotFoundException('Código ou QR Code inválido');
        }
        if (delivery.status !== DeliveryStatus.PENDING) {
          throw new BadRequestException('Esta entrega já foi retirada ou devolvida');
        }
        if (!delivery.pickupCredentialExpires || delivery.pickupCredentialExpires.getTime() <= Date.now()) {
          throw new BadRequestException('A credencial de retirada expirou. Gere uma nova.');
        }
        return tx.delivery.update({
          where: { id: delivery.id },
          data: {
            status: DeliveryStatus.COLLECTED,
            collectedAt: new Date(),
            pickedUpBy: data.pickedUpBy,
            pickupDocument: data.pickupDocument ?? null,
            pickupPhotoId: data.pickupPhotoId ?? null,
            pickupCredentialUsedAt: new Date(),
          },
        });
      }),
    );
  }

  /** Reemite a credencial de uma entrega ainda pendente (código perdido/expirado). */
  async reissuePickupCredential(actor: Actor, deliveryId: string): Promise<DeliveryWithCredential> {
    this.assertCanOperate(actor);
    const scope = resolveTenantScope(actor);
    const secret = this.config.get('PICKUP_CREDENTIAL_SECRET', { infer: true });
    const ttlHours = this.config.get('PICKUP_CREDENTIAL_TTL_HOURS', { infer: true });
    const pickupCode = generatePickupCode();
    const qrToken = generateQrToken();

    const delivery = await auditedOperation(this.audit, actor, scope, 'delivery.credential_reissue', 'Delivery', () =>
      this.prisma.withTenantContext(scope, async (tx) => {
        const current = await tx.delivery.findUniqueOrThrow({ where: { id: deliveryId } });
        if (current.status !== DeliveryStatus.PENDING) {
          throw new BadRequestException('Esta entrega não está aguardando retirada');
        }
        return tx.delivery.update({
          where: { id: current.id },
          data: {
            pickupCodeHash: credentialHash(pickupCode, secret),
            pickupCodeLast4: pickupCode.slice(-4),
            pickupQrHash: credentialHash(qrToken, secret),
            pickupCredentialExpires: new Date(Date.now() + ttlHours * 3600_000),
            pickupCredentialUsedAt: null,
          },
        });
      }),
    );

    await this.notifyPickupCode(scope, delivery, pickupCode);

    return {
      delivery,
      pickupCode,
      qrToken,
      qrPayload: buildQrPayload(delivery.id, qrToken),
      expiresAt: delivery.pickupCredentialExpires,
    };
  }

  /**
   * Enfileira o código no outbox e tenta despachar pelo WhatsApp. Uma falha
   * aqui nunca derruba o registro da entrega — a encomenda já está fisicamente
   * na portaria, e o outbox preserva a tentativa com o motivo do erro.
   */
  private async notifyPickupCode(
    scope: ReturnType<typeof resolveTenantScope>,
    delivery: Delivery,
    pickupCode: string,
  ): Promise<void> {
    if (!delivery.residentId) return;
    try {
      const resident = await this.prisma.withTenantContext(scope, (tx) =>
        tx.resident.findUnique({ where: { id: delivery.residentId as string } }),
      );
      if (!resident?.phone) return;
      await this.notifications.dispatchDeliveryPickupCode({
        delivery,
        resident,
        pickupCode,
      });
    } catch (error) {
      this.logger.warn({ err: error, deliveryId: delivery.id }, 'Falha ao notificar o código de retirada');
    }
  }

  async listDeliveries(
    actor: Actor,
    condominiumId: string,
    query: PaginationQuery,
    status?: DeliveryStatus,
  ): Promise<Paginated<Delivery>> {
    this.assertCanOperate(actor);
    const scope = resolveTenantScope(actor);
    const where = { condominiumId, ...(status ? { status } : {}) };
    const [items, total] = await this.prisma.withTenantContext(scope, (tx) =>
      Promise.all([
        tx.delivery.findMany({
          where,
          orderBy: { receivedAt: 'desc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        tx.delivery.count({ where }),
      ]),
    );
    return paginate(items, total, query);
  }

  async createKeyRecord(actor: Actor, input: CreateKeyRecordInput): Promise<KeyRecord> {
    this.assertCanOperate(actor);
    const data = createKeyRecordSchema.parse(input);
    const scope = resolveTenantScope(actor);

    return auditedOperation(this.audit, actor, scope, 'key_record.create', 'KeyRecord', async () => {
      const unit = await this.prisma.withTenantContext(scope, (tx) =>
        tx.unit.findUniqueOrThrow({ where: { id: data.unitId } }),
      );
      return this.prisma.withTenantContext(scope, (tx) =>
        tx.keyRecord.create({
          data: {
            unitId: unit.id,
            label: data.label,
            resaleId: unit.resaleId,
            clientId: unit.clientId,
            condominiumId: unit.condominiumId,
          },
        }),
      );
    });
  }

  async checkOutKey(actor: Actor, input: CheckOutKeyInput): Promise<KeyRecord> {
    this.assertCanOperate(actor);
    const data = checkOutKeySchema.parse(input);
    const scope = resolveTenantScope(actor);

    return auditedOperation(this.audit, actor, scope, 'key_record.check_out', 'KeyRecord', () =>
      this.prisma.withTenantContext(scope, async (tx) => {
        const key = await tx.keyRecord.findUniqueOrThrow({ where: { id: data.keyRecordId } });
        if (key.status !== KeyRecordStatus.WITH_GATEHOUSE) {
          throw new BadRequestException('Chave já está retirada');
        }
        return tx.keyRecord.update({
          where: { id: key.id },
          data: { status: KeyRecordStatus.CHECKED_OUT, checkedOutTo: data.checkedOutTo, checkedOutAt: new Date() },
        });
      }),
    );
  }

  async returnKey(actor: Actor, keyRecordId: string): Promise<KeyRecord> {
    this.assertCanOperate(actor);
    const scope = resolveTenantScope(actor);

    return auditedOperation(this.audit, actor, scope, 'key_record.return', 'KeyRecord', () =>
      this.prisma.withTenantContext(scope, async (tx) => {
        const key = await tx.keyRecord.findUniqueOrThrow({ where: { id: keyRecordId } });
        if (key.status !== KeyRecordStatus.CHECKED_OUT) {
          throw new BadRequestException('Chave não está retirada');
        }
        return tx.keyRecord.update({
          where: { id: key.id },
          data: { status: KeyRecordStatus.WITH_GATEHOUSE, returnedAt: new Date() },
        });
      }),
    );
  }

  async listKeyRecords(
    actor: Actor,
    condominiumId: string,
    query: PaginationQuery,
    status?: KeyRecordStatus,
  ): Promise<Paginated<KeyRecord>> {
    this.assertCanOperate(actor);
    const scope = resolveTenantScope(actor);
    const where = { condominiumId, ...(status ? { status } : {}) };
    const [items, total] = await this.prisma.withTenantContext(scope, (tx) =>
      Promise.all([
        tx.keyRecord.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        tx.keyRecord.count({ where }),
      ]),
    );
    return paginate(items, total, query);
  }

  private assertCanOperate(actor: Actor): void {
    if (!roleHasPermission(actor.role, PERMISSIONS.GATEHOUSE_OPERATE)) {
      throw new ForbiddenException('Papel sem permissão para operar a portaria');
    }
  }

}
