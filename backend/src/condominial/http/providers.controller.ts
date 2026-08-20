import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CondominialService } from '../condominial.service';
import { CurrentActor } from '../../auth/http/current-actor.decorator';
import { RequirePermission } from '../../auth/http/require-permission.decorator';
import { PERMISSIONS } from '../../auth/rbac/permissions';
import { Idempotent } from '../../common/http/idempotent.decorator';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import { paginationQuerySchema, type PaginationQuery, type Paginated } from '../../common/http/pagination';
import { scopeIdSchema } from '../../common/http/scope-id.schema';
import { createProviderSchema, type CreateProviderInput } from '../dto';
import { toProviderResponse, type ProviderResponse } from './response.mappers';
import type { Actor } from '../../auth/actor';

@ApiTags('condominial')
@ApiBearerAuth()
@Controller('condominial/providers')
export class ProvidersController {
  constructor(private readonly condominial: CondominialService) {}

  @Get()
  @RequirePermission(PERMISSIONS.REPORTS_VIEW)
  @ApiOperation({ summary: 'Lista prestadores cadastrados de um condomínio (paginado).' })
  async list(
    @CurrentActor() actor: Actor,
    @Query('condominiumId', new ZodValidationPipe(scopeIdSchema)) condominiumId: string,
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
  ): Promise<Paginated<ProviderResponse>> {
    const result = await this.condominial.listProviders(actor, condominiumId, query);
    return { ...result, items: result.items.map(toProviderResponse) };
  }

  @Post()
  @RequirePermission(PERMISSIONS.CONDOMINIUM_MANAGE)
  @Idempotent('POST /condominial/providers')
  @ApiOperation({ summary: 'Cadastra um prestador. Requer header Idempotency-Key.' })
  async create(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(createProviderSchema)) body: CreateProviderInput,
  ): Promise<ProviderResponse> {
    const provider = await this.condominial.createProvider(actor, body);
    return toProviderResponse(provider);
  }
}
