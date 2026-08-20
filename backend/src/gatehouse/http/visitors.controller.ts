import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GatehouseService } from '../gatehouse.service';
import { CurrentActor } from '../../auth/http/current-actor.decorator';
import { RequirePermission } from '../../auth/http/require-permission.decorator';
import { PERMISSIONS } from '../../auth/rbac/permissions';
import { Idempotent } from '../../common/http/idempotent.decorator';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import { paginationQuerySchema, type PaginationQuery, type Paginated } from '../../common/http/pagination';
import { scopeIdSchema } from '../../common/http/scope-id.schema';
import { createVisitorSchema, type CreateVisitorInput } from '../dto';
import { toVisitorResponse, type VisitorResponse } from './response.mappers';
import type { Actor } from '../../auth/actor';

@ApiTags('gatehouse')
@ApiBearerAuth()
@Controller('gatehouse/visitors')
export class VisitorsController {
  constructor(private readonly gatehouse: GatehouseService) {}

  @Get()
  @RequirePermission(PERMISSIONS.GATEHOUSE_OPERATE)
  @ApiOperation({ summary: 'Lista visitantes registrados de um condomínio (paginado).' })
  async list(
    @CurrentActor() actor: Actor,
    @Query('condominiumId', new ZodValidationPipe(scopeIdSchema)) condominiumId: string,
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
  ): Promise<Paginated<VisitorResponse>> {
    const result = await this.gatehouse.listVisitors(actor, condominiumId, query);
    return { ...result, items: result.items.map(toVisitorResponse) };
  }

  @Post()
  @RequirePermission(PERMISSIONS.GATEHOUSE_OPERATE)
  @Idempotent('POST /gatehouse/visitors')
  @ApiOperation({ summary: 'Registra um visitante com autorização aprovada. Requer header Idempotency-Key.' })
  async register(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(createVisitorSchema)) body: CreateVisitorInput,
  ): Promise<VisitorResponse> {
    const visitor = await this.gatehouse.registerVisitor(actor, body);
    return toVisitorResponse(visitor);
  }
}
