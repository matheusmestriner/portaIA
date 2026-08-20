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
import { createVehicleSchema, type CreateVehicleInput } from '../dto';
import { toVehicleResponse, type VehicleResponse } from './response.mappers';
import type { Actor } from '../../auth/actor';

@ApiTags('condominial')
@ApiBearerAuth()
@Controller('condominial/vehicles')
export class VehiclesController {
  constructor(private readonly condominial: CondominialService) {}

  @Get()
  @RequirePermission(PERMISSIONS.REPORTS_VIEW)
  @ApiOperation({ summary: 'Lista veículos cadastrados de um condomínio (paginado).' })
  async list(
    @CurrentActor() actor: Actor,
    @Query('condominiumId', new ZodValidationPipe(scopeIdSchema)) condominiumId: string,
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
  ): Promise<Paginated<VehicleResponse>> {
    const result = await this.condominial.listVehicles(actor, condominiumId, query);
    return { ...result, items: result.items.map(toVehicleResponse) };
  }

  @Post()
  @RequirePermission(PERMISSIONS.CONDOMINIUM_MANAGE)
  @Idempotent('POST /condominial/vehicles')
  @ApiOperation({ summary: 'Cadastra um veículo. Requer header Idempotency-Key.' })
  async create(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(createVehicleSchema)) body: CreateVehicleInput,
  ): Promise<VehicleResponse> {
    const vehicle = await this.condominial.createVehicle(actor, body);
    return toVehicleResponse(vehicle);
  }
}
