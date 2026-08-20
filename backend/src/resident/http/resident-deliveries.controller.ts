import { Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ResidentService } from '../resident.service';
import { PublicRoute } from '../../auth/http/public-route.decorator';
import { ResidentJwtAuthGuard } from '../../resident-auth/http/resident-jwt-auth.guard';
import { ResidentMustChangePasswordGuard } from '../../resident-auth/http/resident-must-change-password.guard';
import { CurrentResident } from '../../resident-auth/http/current-resident.decorator';
import { ResidentIdempotent } from '../../common/http/resident-idempotent.decorator';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import { paginationQuerySchema, type PaginationQuery, type Paginated } from '../../common/http/pagination';
import { toDeliveryListItemResponse, toDeliveryCredentialResponse, type DeliveryListItemResponse } from '../../gatehouse/http/response.mappers';
import type { ResidentActor } from '../../resident-auth/resident-actor';

@ApiTags('resident')
@Controller('resident/deliveries')
@PublicRoute()
@UseGuards(ResidentJwtAuthGuard, ResidentMustChangePasswordGuard)
export class ResidentDeliveriesController {
  constructor(private readonly resident: ResidentService) {}

  @Get()
  @ApiOperation({ summary: 'Entregas da própria unidade (paginado). O código/QR não aparece aqui — só na emissão/reemissão da credencial.' })
  async list(
    @CurrentResident() resident: ResidentActor,
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
  ): Promise<Paginated<DeliveryListItemResponse>> {
    const result = await this.resident.listDeliveries(resident, query);
    return { ...result, items: result.items.map(toDeliveryListItemResponse) };
  }

  @Post(':id/credential')
  @ResidentIdempotent('POST /resident/deliveries/:id/credential')
  @ApiOperation({
    summary:
      'Emite um novo código + QR de retirada (em claro, uma única vez) para uma entrega pendente da própria unidade. ' +
      'Requer header Idempotency-Key.',
  })
  async reissueCredential(@CurrentResident() resident: ResidentActor, @Param('id', ParseUUIDPipe) id: string) {
    const result = await this.resident.reissueDeliveryCredential(resident, id);
    return toDeliveryCredentialResponse(result);
  }
}
