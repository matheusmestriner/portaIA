import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SecurityService } from '../security.service';
import { CurrentActor } from '../../auth/http/current-actor.decorator';
import { RequirePermission } from '../../auth/http/require-permission.decorator';
import { PERMISSIONS } from '../../auth/rbac/permissions';
import { Idempotent } from '../../common/http/idempotent.decorator';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import type { Paginated } from '../../common/http/pagination';
import { scopeIdSchema } from '../../common/http/scope-id.schema';
import {
  createOccurrenceSchema,
  listOccurrencesQuerySchema,
  type CreateOccurrenceInput,
  type ListOccurrencesQuery,
} from '../dto';
import { toOccurrenceResponse, type OccurrenceResponse } from './response.mappers';
import type { Actor } from '../../auth/actor';

@ApiTags('security')
@ApiBearerAuth()
@Controller('security/occurrences')
export class OccurrencesController {
  constructor(private readonly security: SecurityService) {}

  @Get()
  @RequirePermission(PERMISSIONS.SECURITY_OPERATE)
  @ApiOperation({ summary: 'Lista ocorrências de um condomínio (paginado), com filtro opcional de status.' })
  async list(
    @CurrentActor() actor: Actor,
    @Query('condominiumId', new ZodValidationPipe(scopeIdSchema)) condominiumId: string,
    @Query(new ZodValidationPipe(listOccurrencesQuerySchema)) query: ListOccurrencesQuery,
  ): Promise<Paginated<OccurrenceResponse>> {
    const { status, ...pagination } = query;
    const result = await this.security.listOccurrences(actor, condominiumId, pagination, status);
    return { ...result, items: result.items.map(toOccurrenceResponse) };
  }

  @Post()
  @RequirePermission(PERMISSIONS.SECURITY_OPERATE)
  @Idempotent('POST /security/occurrences')
  @ApiOperation({ summary: 'Registra uma ocorrência. Requer header Idempotency-Key.' })
  async report(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(createOccurrenceSchema)) body: CreateOccurrenceInput,
  ): Promise<OccurrenceResponse> {
    const occurrence = await this.security.reportOccurrence(actor, body);
    return toOccurrenceResponse(occurrence);
  }
}
