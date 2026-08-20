import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenancyService } from '../tenancy.service';
import { CurrentActor } from '../../auth/http/current-actor.decorator';
import { RequirePermission } from '../../auth/http/require-permission.decorator';
import { PERMISSIONS } from '../../auth/rbac/permissions';
import { Idempotent } from '../../common/http/idempotent.decorator';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import { paginationQuerySchema, type PaginationQuery, type Paginated } from '../../common/http/pagination';
import { scopeIdSchema } from '../../common/http/scope-id.schema';
import { createCondominiumSchema, type CreateCondominiumInput } from '../dto';
import { toCondominiumResponse, type CondominiumResponse } from './response.mappers';
import type { Actor } from '../../auth/actor';

@ApiTags('platform')
@ApiBearerAuth()
@Controller('platform/condominiums')
export class CondominiumsController {
  constructor(private readonly tenancy: TenancyService) {}

  @Get()
  @RequirePermission(PERMISSIONS.REPORTS_VIEW)
  @ApiOperation({ summary: 'Lista condomínios de um cliente (paginado).' })
  async list(
    @CurrentActor() actor: Actor,
    @Query('clientId', new ZodValidationPipe(scopeIdSchema)) clientId: string,
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
  ): Promise<Paginated<CondominiumResponse>> {
    const result = await this.tenancy.listCondominiums(actor, clientId, query);
    return { ...result, items: result.items.map(toCondominiumResponse) };
  }

  @Post()
  @RequirePermission(PERMISSIONS.CLIENT_MANAGE)
  @Idempotent('POST /platform/condominiums')
  @ApiOperation({ summary: 'Cria um condomínio sob um cliente. Requer header Idempotency-Key.' })
  async create(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(createCondominiumSchema)) body: CreateCondominiumInput,
  ): Promise<CondominiumResponse> {
    const condominium = await this.tenancy.createCondominium(actor, body);
    return toCondominiumResponse(condominium);
  }
}
