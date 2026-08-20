import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrivacyService, type DataExportResult } from '../privacy.service';
import { CurrentActor } from '../../auth/http/current-actor.decorator';
import { RequirePermission } from '../../auth/http/require-permission.decorator';
import { PERMISSIONS } from '../../auth/rbac/permissions';
import { Idempotent } from '../../common/http/idempotent.decorator';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import { paginationQuerySchema, type PaginationQuery, type Paginated } from '../../common/http/pagination';
import { scopeIdSchema } from '../../common/http/scope-id.schema';
import {
  createDataSubjectRequestSchema,
  createLegalHoldSchema,
  recordConsentSchema,
  resolveDataSubjectRequestSchema,
  type CreateDataSubjectRequestInput,
  type CreateLegalHoldInput,
  type RecordConsentInput,
  type ResolveDataSubjectRequestInput,
} from '../dto';
import {
  toConsentResponse,
  toDataSubjectRequestResponse,
  toLegalHoldResponse,
  type ConsentResponse,
  type DataSubjectRequestResponse,
  type LegalHoldResponse,
} from './response.mappers';
import type { Actor } from '../../auth/actor';

@ApiTags('privacy')
@ApiBearerAuth()
@Controller('privacy')
export class PrivacyController {
  constructor(private readonly privacy: PrivacyService) {}

  // ---------------------------------------------------------------------
  // Consentimentos
  // ---------------------------------------------------------------------

  @Get('consents')
  @RequirePermission(PERMISSIONS.REPORTS_VIEW)
  @ApiOperation({ summary: 'Lista consentimentos registrados de um condomínio (paginado).' })
  async listConsents(
    @CurrentActor() actor: Actor,
    @Query('condominiumId', new ZodValidationPipe(scopeIdSchema)) condominiumId: string,
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
  ): Promise<Paginated<ConsentResponse>> {
    const result = await this.privacy.listConsents(actor, condominiumId, query);
    return { ...result, items: result.items.map(toConsentResponse) };
  }

  @Post('consents')
  @RequirePermission(PERMISSIONS.PRIVACY_MANAGE)
  @Idempotent('POST /privacy/consents')
  @ApiOperation({ summary: 'Registra um consentimento (concedido ou revogado). Requer header Idempotency-Key.' })
  async recordConsent(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(recordConsentSchema)) body: RecordConsentInput,
  ): Promise<ConsentResponse> {
    const consent = await this.privacy.recordConsent(actor, body);
    return toConsentResponse(consent);
  }

  // ---------------------------------------------------------------------
  // Solicitações LGPD
  // ---------------------------------------------------------------------

  @Get('requests')
  @RequirePermission(PERMISSIONS.REPORTS_VIEW)
  @ApiOperation({ summary: 'Lista solicitações de titular de dados de um condomínio (paginado).' })
  async listRequests(
    @CurrentActor() actor: Actor,
    @Query('condominiumId', new ZodValidationPipe(scopeIdSchema)) condominiumId: string,
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
  ): Promise<Paginated<DataSubjectRequestResponse>> {
    const result = await this.privacy.listRequests(actor, condominiumId, query);
    return { ...result, items: result.items.map(toDataSubjectRequestResponse) };
  }

  @Post('requests')
  @RequirePermission(PERMISSIONS.PRIVACY_MANAGE)
  @Idempotent('POST /privacy/requests')
  @ApiOperation({ summary: 'Registra uma solicitação LGPD (acesso, correção, exclusão, portabilidade). Requer header Idempotency-Key.' })
  async createRequest(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(createDataSubjectRequestSchema)) body: CreateDataSubjectRequestInput,
  ): Promise<DataSubjectRequestResponse> {
    const created = await this.privacy.createRequest(actor, body);
    return toDataSubjectRequestResponse(created);
  }

  @Post('requests/:id/resolve')
  @RequirePermission(PERMISSIONS.PRIVACY_MANAGE)
  @Idempotent('POST /privacy/requests/:id/resolve')
  @ApiOperation({
    summary:
      'Aprova ou rejeita uma solicitação LGPD. Exclusão aprovada é bloqueada se houver legal hold ativo para o documento. Requer header Idempotency-Key.',
  })
  async resolveRequest(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(resolveDataSubjectRequestSchema)) body: ResolveDataSubjectRequestInput,
  ): Promise<DataSubjectRequestResponse> {
    const resolved = await this.privacy.resolveRequest(actor, id, body);
    return toDataSubjectRequestResponse(resolved);
  }

  @Get('requests/:id/export')
  @RequirePermission(PERMISSIONS.PRIVACY_MANAGE)
  @ApiOperation({
    summary:
      'Exporta os dados encontrados para uma solicitação de acesso/portabilidade (best-effort — ver nota no corpo da resposta).',
  })
  async exportRequest(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DataExportResult> {
    return this.privacy.exportForRequest(actor, id);
  }

  // ---------------------------------------------------------------------
  // Legal hold
  // ---------------------------------------------------------------------

  @Get('legal-holds')
  @RequirePermission(PERMISSIONS.REPORTS_VIEW)
  @ApiOperation({ summary: 'Lista legal holds de um condomínio (paginado).' })
  async listLegalHolds(
    @CurrentActor() actor: Actor,
    @Query('condominiumId', new ZodValidationPipe(scopeIdSchema)) condominiumId: string,
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
  ): Promise<Paginated<LegalHoldResponse>> {
    const result = await this.privacy.listLegalHolds(actor, condominiumId, query);
    return { ...result, items: result.items.map(toLegalHoldResponse) };
  }

  @Post('legal-holds')
  @RequirePermission(PERMISSIONS.PRIVACY_MANAGE)
  @Idempotent('POST /privacy/legal-holds')
  @ApiOperation({ summary: 'Cria um legal hold para um documento, bloqueando exclusões LGPD futuras. Requer header Idempotency-Key.' })
  async createLegalHold(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(createLegalHoldSchema)) body: CreateLegalHoldInput,
  ): Promise<LegalHoldResponse> {
    const hold = await this.privacy.createLegalHold(actor, body);
    return toLegalHoldResponse(hold);
  }

  @Post('legal-holds/:id/lift')
  @RequirePermission(PERMISSIONS.PRIVACY_MANAGE)
  @Idempotent('POST /privacy/legal-holds/:id/lift')
  @ApiOperation({ summary: 'Levanta um legal hold ativo. Requer header Idempotency-Key.' })
  async liftLegalHold(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<LegalHoldResponse> {
    const hold = await this.privacy.liftLegalHold(actor, id);
    return toLegalHoldResponse(hold);
  }
}
