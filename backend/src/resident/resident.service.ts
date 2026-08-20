import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditResult, DeliveryStatus, type Announcement, type Condominium, type Delivery, type Resident, type Unit } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { paginate, type PaginationQuery, type Paginated } from '../common/http/pagination';
import { buildQrPayload, credentialHash, generatePickupCode, generateQrToken } from '../gatehouse/pickup-credential';
import { decryptSipPassword } from '../telephony/sip-credential.crypto';
import type { DeliveryWithCredential } from '../gatehouse/gatehouse.service';
import type { EnvConfig } from '../config/env.schema';
import type { ResidentActor } from '../resident-auth/resident-actor';
import type { ResidentDashboardResponse, ResidentTelephonyCredentialsResponse } from './http/response.mappers';

type ResidentWithUnitAndCondominium = Resident & { unit: Unit & { condominium: Condominium } };

/**
 * Toda leitura/escrita aqui é escopada em duas camadas: o RLS de 3 níveis
 * (resale/client/condominium, igual ao resto do app — não existe nível
 * "unidade" na RLS) MAIS um filtro explícito por unitId no código, já que a
 * RLS por si só deixaria um morador enxergar dados de outras unidades do
 * mesmo condomínio. unitId/condominiumId vêm sempre do ator (claims do JWT
 * verificado), nunca de parâmetro de rota/query.
 */
@Injectable()
export class ResidentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  private scopeOf(resident: ResidentActor) {
    return { resaleId: resident.resaleId, clientId: resident.clientId, condominiumId: resident.condominiumId };
  }

  async getMe(resident: ResidentActor): Promise<ResidentWithUnitAndCondominium> {
    const scope = this.scopeOf(resident);
    return this.prisma.withTenantContext(scope, (tx) =>
      tx.resident.findUniqueOrThrow({
        where: { id: resident.id },
        include: { unit: { include: { condominium: true } } },
      }),
    );
  }

  async getDashboard(resident: ResidentActor): Promise<ResidentDashboardResponse> {
    const scope = this.scopeOf(resident);
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const WEEKS_WINDOW = 8;
    const windowStart = new Date(Date.now() - WEEKS_WINDOW * 7 * 24 * 3600_000);

    const [pendingDeliveries, visitorsThisMonth, visitorsInWindow] = await this.prisma.withTenantContext(
      scope,
      (tx) =>
        Promise.all([
          tx.delivery.count({ where: { unitId: resident.unitId, status: DeliveryStatus.PENDING } }),
          tx.visitor.count({ where: { unitId: resident.unitId, createdAt: { gte: startOfMonth } } }),
          tx.visitor.count({ where: { unitId: resident.unitId, createdAt: { gte: windowStart } } }),
        ]),
    );

    return {
      pendingDeliveries,
      visitorsThisMonth,
      avgVisitsPerWeek: visitorsInWindow > 0 ? Math.round((visitorsInWindow / WEEKS_WINDOW) * 10) / 10 : 0,
      avgVisitDurationMinutes: null,
    };
  }

  async listAnnouncements(resident: ResidentActor, query: PaginationQuery): Promise<Paginated<Announcement>> {
    const scope = this.scopeOf(resident);
    const where = { condominiumId: resident.condominiumId };
    const [items, total] = await this.prisma.withTenantContext(scope, (tx) =>
      Promise.all([
        tx.announcement.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        tx.announcement.count({ where }),
      ]),
    );
    return paginate(items, total, query);
  }

  async listDeliveries(resident: ResidentActor, query: PaginationQuery): Promise<Paginated<Delivery>> {
    const scope = this.scopeOf(resident);
    const where = { unitId: resident.unitId };
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

  /**
   * Mesma mecânica de reemissão do lado da portaria (GatehouseService.reissuePickupCredential):
   * código de 6 dígitos + token de QR novos, em claro só nesta resposta, só o
   * HMAC persistido. A diferença é a checagem de posse — aqui é "essa entrega
   * é da minha própria unidade", não uma permissão de equipe.
   */
  async reissueDeliveryCredential(resident: ResidentActor, deliveryId: string): Promise<DeliveryWithCredential> {
    const scope = this.scopeOf(resident);
    const secret = this.config.get('PICKUP_CREDENTIAL_SECRET', { infer: true });
    const ttlHours = this.config.get('PICKUP_CREDENTIAL_TTL_HOURS', { infer: true });
    const pickupCode = generatePickupCode();
    const qrToken = generateQrToken();

    const delivery = await this.prisma.withTenantContext(scope, async (tx) => {
      const current = await tx.delivery.findUniqueOrThrow({ where: { id: deliveryId } });
      if (current.unitId !== resident.unitId) {
        throw new ForbiddenException('Esta entrega não pertence à sua unidade');
      }
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
    });

    await this.audit.record({
      actorUserId: resident.id,
      actorRole: 'RESIDENT',
      scope,
      action: 'resident.delivery.credential_reissue',
      targetType: 'Delivery',
      targetId: delivery.id,
      result: AuditResult.SUCCESS,
    });

    return {
      delivery,
      pickupCode,
      qrToken,
      qrPayload: buildQrPayload(delivery.id, qrToken),
      expiresAt: delivery.pickupCredentialExpires,
    };
  }

  /**
   * Único endpoint que de fato chama decryptSipPassword em produção — até
   * aqui a função só era exercitada em teste (ver sip-credential.crypto.spec.ts).
   * Sem SIP_DOMAIN configurado (nenhum Asterisk real conectado na V01), a
   * resposta é honesta: configured:false, mesmo que a extensão já exista.
   */
  async getTelephonyCredentials(resident: ResidentActor): Promise<ResidentTelephonyCredentialsResponse> {
    const scope = this.scopeOf(resident);
    const extension = await this.prisma.withTenantContext(scope, (tx) =>
      tx.extension.findUnique({ where: { unitId: resident.unitId } }),
    );
    const domain = this.config.get('SIP_DOMAIN', { infer: true }) ?? null;

    if (!extension) {
      return { configured: false, sipUsername: null, sipPassword: null, domain };
    }

    const sipPassword = decryptSipPassword(extension.sipPasswordEncrypted, this.config.get('TELEPHONY_SIP_SECRET_KEY', { infer: true }));

    return {
      configured: Boolean(domain),
      sipUsername: extension.sipUsername,
      sipPassword,
      domain,
    };
  }
}
