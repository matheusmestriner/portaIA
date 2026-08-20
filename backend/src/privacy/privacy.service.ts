import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import {
  DataSubjectRequestStatus,
  DataSubjectRequestType,
  type Consent,
  type DataSubjectRequest,
  type LegalHold,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { auditedOperation } from '../common/audit/audited-operation';
import { PERMISSIONS, roleHasPermission } from '../auth/rbac/permissions';
import { resolveTenantScope } from '../auth/rbac/tenant-scope.resolver';
import { paginate, type PaginationQuery, type Paginated } from '../common/http/pagination';
import type { Actor } from '../auth/actor';
import {
  createDataSubjectRequestSchema,
  createLegalHoldSchema,
  recordConsentSchema,
  resolveDataSubjectRequestSchema,
  type CreateDataSubjectRequestInput,
  type CreateLegalHoldInput,
  type RecordConsentInput,
  type ResolveDataSubjectRequestInput,
} from './dto';

export interface DataExportResult {
  requestId: string;
  document: string;
  visitors: unknown[];
  providers: unknown[];
  blockListEntries: unknown[];
  note: string;
}

@Injectable()
export class PrivacyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async recordConsent(actor: Actor, input: RecordConsentInput): Promise<Consent> {
    this.assertCanManage(actor);
    const data = recordConsentSchema.parse(input);
    const scope = resolveTenantScope(actor);

    return auditedOperation(this.audit, actor, scope, 'consent.record', 'Consent', () =>
      this.prisma.withTenantContext(scope, async (tx) => {
        const condominium = await tx.condominium.findUniqueOrThrow({ where: { id: data.condominiumId } });
        return tx.consent.create({
          data: {
            condominiumId: condominium.id,
            resaleId: condominium.resaleId,
            clientId: condominium.clientId,
            subjectName: data.subjectName,
            subjectDocument: data.subjectDocument,
            purpose: data.purpose,
            granted: data.granted,
            grantedAt: data.granted ? new Date() : null,
            revokedAt: data.granted ? null : new Date(),
          },
        });
      }),
    );
  }

  async listConsents(actor: Actor, condominiumId: string, query: PaginationQuery): Promise<Paginated<Consent>> {
    const scope = resolveTenantScope(actor);
    const [items, total] = await this.prisma.withTenantContext(scope, (tx) =>
      Promise.all([
        tx.consent.findMany({
          where: { condominiumId },
          orderBy: { createdAt: 'desc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        tx.consent.count({ where: { condominiumId } }),
      ]),
    );
    return paginate(items, total, query);
  }

  async createRequest(actor: Actor, input: CreateDataSubjectRequestInput): Promise<DataSubjectRequest> {
    this.assertCanManage(actor);
    const data = createDataSubjectRequestSchema.parse(input);
    const scope = resolveTenantScope(actor);

    return auditedOperation(this.audit, actor, scope, 'data_subject_request.create', 'DataSubjectRequest', () =>
      this.prisma.withTenantContext(scope, async (tx) => {
        const condominium = await tx.condominium.findUniqueOrThrow({ where: { id: data.condominiumId } });
        return tx.dataSubjectRequest.create({
          data: {
            condominiumId: condominium.id,
            resaleId: condominium.resaleId,
            clientId: condominium.clientId,
            requesterName: data.requesterName,
            requesterDocument: data.requesterDocument,
            type: data.type,
            details: data.details,
          },
        });
      }),
    );
  }

  async listRequests(actor: Actor, condominiumId: string, query: PaginationQuery): Promise<Paginated<DataSubjectRequest>> {
    const scope = resolveTenantScope(actor);
    const [items, total] = await this.prisma.withTenantContext(scope, (tx) =>
      Promise.all([
        tx.dataSubjectRequest.findMany({
          where: { condominiumId },
          orderBy: { createdAt: 'desc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        tx.dataSubjectRequest.count({ where: { condominiumId } }),
      ]),
    );
    return paginate(items, total, query);
  }

  /**
   * Approving a DELETION request while an active legal hold matches the
   * requester's document is blocked outright — the hold has to be lifted
   * first. This module only gates the workflow: actually deleting or
   * anonymizing the subject's records across every table that might
   * reference them is a larger, cross-cutting piece deliberately left out
   * of V01 (see docs/V01_SCOPE.md).
   */
  async resolveRequest(
    actor: Actor,
    requestId: string,
    input: ResolveDataSubjectRequestInput,
  ): Promise<DataSubjectRequest> {
    this.assertCanManage(actor);
    const data = resolveDataSubjectRequestSchema.parse(input);
    const scope = resolveTenantScope(actor);

    return auditedOperation(this.audit, actor, scope, 'data_subject_request.resolve', 'DataSubjectRequest', () =>
      this.prisma.withTenantContext(scope, async (tx) => {
        const request = await tx.dataSubjectRequest.findUniqueOrThrow({ where: { id: requestId } });
        if (request.status !== DataSubjectRequestStatus.OPEN && request.status !== DataSubjectRequestStatus.IN_PROGRESS) {
          throw new BadRequestException('Solicitação já foi resolvida');
        }

        if (data.approve && request.type === DataSubjectRequestType.DELETION) {
          const activeHold = await tx.legalHold.findFirst({
            where: { subjectDocument: request.requesterDocument, liftedAt: null },
          });
          if (activeHold) {
            throw new ConflictException(
              `Solicitação de exclusão bloqueada por legal hold ativo (motivo: ${activeHold.reason}). Levante o hold antes de aprovar.`,
            );
          }
        }

        return tx.dataSubjectRequest.update({
          where: { id: requestId },
          data: {
            status: data.approve ? DataSubjectRequestStatus.COMPLETED : DataSubjectRequestStatus.REJECTED,
            resolvedBy: actor.id,
            resolutionNotes: data.resolutionNotes,
            resolvedAt: new Date(),
          },
        });
      }),
    );
  }

  /**
   * Best-effort export: Resident has no document field in V01 (a real gap,
   * documented in docs/V01_SCOPE.md), so this can only match Visitor,
   * Provider and BlockListEntry rows — the entities that actually store a
   * `document` column — against the request's requesterDocument.
   */
  async exportForRequest(actor: Actor, requestId: string): Promise<DataExportResult> {
    this.assertCanManage(actor);
    const scope = resolveTenantScope(actor);

    return auditedOperation(this.audit,
      actor,
      scope,
      'data_subject_request.export',
      'DataSubjectRequest',
      () =>
        this.prisma.withTenantContext(scope, async (tx) => {
          const request = await tx.dataSubjectRequest.findUniqueOrThrow({ where: { id: requestId } });
          if (
            request.type !== DataSubjectRequestType.ACCESS &&
            request.type !== DataSubjectRequestType.PORTABILITY
          ) {
            throw new BadRequestException('Exportação só se aplica a solicitações de acesso ou portabilidade');
          }

          const [visitors, providers, blockListEntries] = await Promise.all([
            tx.visitor.findMany({ where: { condominiumId: request.condominiumId, document: request.requesterDocument } }),
            tx.provider.findMany({ where: { condominiumId: request.condominiumId, document: request.requesterDocument } }),
            tx.blockListEntry.findMany({
              where: { condominiumId: request.condominiumId, document: request.requesterDocument },
            }),
          ]);

          return {
            requestId: request.id,
            document: request.requesterDocument,
            visitors,
            providers,
            blockListEntries,
            note: 'Exportação best-effort: moradores (Resident) não têm campo de documento na V01 e não são incluídos automaticamente — ver docs/V01_SCOPE.md.',
          };
        }),
      () => requestId,
    );
  }

  async createLegalHold(actor: Actor, input: CreateLegalHoldInput): Promise<LegalHold> {
    this.assertCanManage(actor);
    const data = createLegalHoldSchema.parse(input);
    const scope = resolveTenantScope(actor);

    return auditedOperation(this.audit, actor, scope, 'legal_hold.create', 'LegalHold', () =>
      this.prisma.withTenantContext(scope, async (tx) => {
        const condominium = await tx.condominium.findUniqueOrThrow({ where: { id: data.condominiumId } });
        return tx.legalHold.create({
          data: {
            condominiumId: condominium.id,
            resaleId: condominium.resaleId,
            clientId: condominium.clientId,
            subjectDocument: data.subjectDocument,
            reason: data.reason,
            createdBy: actor.id,
          },
        });
      }),
    );
  }

  async liftLegalHold(actor: Actor, holdId: string): Promise<LegalHold> {
    this.assertCanManage(actor);
    const scope = resolveTenantScope(actor);

    return auditedOperation(this.audit, actor, scope, 'legal_hold.lift', 'LegalHold', () =>
      this.prisma.withTenantContext(scope, async (tx) => {
        const hold = await tx.legalHold.findUniqueOrThrow({ where: { id: holdId } });
        if (hold.liftedAt) {
          throw new BadRequestException('Legal hold já foi levantado');
        }
        return tx.legalHold.update({
          where: { id: holdId },
          data: { liftedAt: new Date(), liftedBy: actor.id },
        });
      }),
    );
  }

  async listLegalHolds(actor: Actor, condominiumId: string, query: PaginationQuery): Promise<Paginated<LegalHold>> {
    const scope = resolveTenantScope(actor);
    const [items, total] = await this.prisma.withTenantContext(scope, (tx) =>
      Promise.all([
        tx.legalHold.findMany({
          where: { condominiumId },
          orderBy: { createdAt: 'desc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        tx.legalHold.count({ where: { condominiumId } }),
      ]),
    );
    return paginate(items, total, query);
  }

  private assertCanManage(actor: Actor): void {
    if (!roleHasPermission(actor.role, PERMISSIONS.PRIVACY_MANAGE)) {
      throw new ForbiddenException('Papel sem permissão para gerenciar privacidade/LGPD');
    }
  }

}
