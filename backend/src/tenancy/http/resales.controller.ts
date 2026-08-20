import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenancyService } from '../tenancy.service';
import { CurrentActor } from '../../auth/http/current-actor.decorator';
import { RequirePermission } from '../../auth/http/require-permission.decorator';
import { PERMISSIONS } from '../../auth/rbac/permissions';
import { Idempotent } from '../../common/http/idempotent.decorator';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import { paginationQuerySchema, type PaginationQuery, type Paginated } from '../../common/http/pagination';
import { createResaleSchema, type CreateResaleInput } from '../dto';
import { toResaleResponse, type ResaleResponse } from './response.mappers';
import type { Actor } from '../../auth/actor';

@ApiTags('platform')
@ApiBearerAuth()
@Controller('platform/resales')
export class ResalesController {
  constructor(private readonly tenancy: TenancyService) {}

  @Get()
  @RequirePermission(PERMISSIONS.PLATFORM_MANAGE)
  @ApiOperation({ summary: 'Lista revendas (paginado). Apenas Super Admin.' })
  async list(
    @CurrentActor() actor: Actor,
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
  ): Promise<Paginated<ResaleResponse>> {
    const result = await this.tenancy.listResales(actor, query);
    return { ...result, items: result.items.map(toResaleResponse) };
  }

  @Post()
  @RequirePermission(PERMISSIONS.PLATFORM_MANAGE)
  @Idempotent('POST /platform/resales')
  @ApiOperation({ summary: 'Cria uma revenda. Apenas Super Admin. Requer header Idempotency-Key.' })
  async create(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(createResaleSchema)) body: CreateResaleInput,
  ): Promise<ResaleResponse> {
    const resale = await this.tenancy.createResale(actor, body);
    return toResaleResponse(resale);
  }
}
