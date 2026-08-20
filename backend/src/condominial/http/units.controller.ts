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
import { createUnitSchema, type CreateUnitInput } from '../dto';
import { toUnitResponse, type UnitResponse } from './unit-response.mapper';
import type { Actor } from '../../auth/actor';

@ApiTags('condominial')
@ApiBearerAuth()
@Controller('condominial/units')
export class UnitsController {
  constructor(private readonly condominial: CondominialService) {}

  // No @RequirePermission here on purpose: any condo-level operate role
  // (gatehouse, security, telephony) needs to look up units to act on them
  // (register a visitor, log a delivery, originate a call, ...) even though
  // REPORTS_VIEW is the only permission that name-fits "view a list" — the
  // OR-check lives in CondominialService.listUnits instead, same pattern as
  // SecurityService.triggerPanicAlert.
  @Get()
  @ApiOperation({ summary: 'Lista unidades de um condomínio (paginado).' })
  async list(
    @CurrentActor() actor: Actor,
    @Query('condominiumId', new ZodValidationPipe(scopeIdSchema)) condominiumId: string,
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
  ): Promise<Paginated<UnitResponse>> {
    const result = await this.condominial.listUnits(actor, condominiumId, query);
    return { ...result, items: result.items.map(toUnitResponse) };
  }

  @Post()
  @RequirePermission(PERMISSIONS.CONDOMINIUM_MANAGE)
  @Idempotent('POST /condominial/units')
  @ApiOperation({ summary: 'Cria uma unidade. Requer header Idempotency-Key.' })
  async create(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(createUnitSchema)) body: CreateUnitInput,
  ): Promise<UnitResponse> {
    const unit = await this.condominial.createUnit(actor, body);
    return toUnitResponse(unit);
  }
}
