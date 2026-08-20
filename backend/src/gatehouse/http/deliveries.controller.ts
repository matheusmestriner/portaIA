import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GatehouseService } from '../gatehouse.service';
import { CurrentActor } from '../../auth/http/current-actor.decorator';
import { RequirePermission } from '../../auth/http/require-permission.decorator';
import { PERMISSIONS } from '../../auth/rbac/permissions';
import { Idempotent } from '../../common/http/idempotent.decorator';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import type { Paginated } from '../../common/http/pagination';
import { scopeIdSchema } from '../../common/http/scope-id.schema';
import {
  createDeliverySchema,
  listDeliveriesQuerySchema,
  redeemDeliverySchema,
  type CreateDeliveryInput,
  type ListDeliveriesQuery,
  type RedeemDeliveryInput,
} from '../dto';
import {
  toDeliveryResponse,
  toDeliveryListItemResponse,
  toDeliveryCredentialResponse,
  type DeliveryResponse,
  type DeliveryListItemResponse,
  type DeliveryCredentialResponse,
} from './response.mappers';
import type { Actor } from '../../auth/actor';

@ApiTags('gatehouse')
@ApiBearerAuth()
@Controller('gatehouse/deliveries')
export class DeliveriesController {
  constructor(private readonly gatehouse: GatehouseService) {}

  @Get()
  @RequirePermission(PERMISSIONS.GATEHOUSE_OPERATE)
  @ApiOperation({
    summary:
      'Lista entregas de um condomínio (paginado), com filtro opcional de status. Não inclui o código de retirada — ele só aparece uma vez, na emissão da credencial.',
  })
  async list(
    @CurrentActor() actor: Actor,
    @Query('condominiumId', new ZodValidationPipe(scopeIdSchema)) condominiumId: string,
    @Query(new ZodValidationPipe(listDeliveriesQuerySchema)) query: ListDeliveriesQuery,
  ): Promise<Paginated<DeliveryListItemResponse>> {
    const { status, ...pagination } = query;
    const result = await this.gatehouse.listDeliveries(actor, condominiumId, pagination, status);
    return { ...result, items: result.items.map(toDeliveryListItemResponse) };
  }

  @Post()
  @RequirePermission(PERMISSIONS.GATEHOUSE_OPERATE)
  @Idempotent('POST /gatehouse/deliveries')
  @ApiOperation({
    summary:
      'Registra uma entrega recebida na portaria, anexa a foto do recebimento e emite a credencial de retirada (código + QR). O código é enviado ao WhatsApp do morador destinatário quando houver telefone e a ponte estiver configurada. Requer header Idempotency-Key.',
  })
  async create(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(createDeliverySchema)) body: CreateDeliveryInput,
  ): Promise<DeliveryCredentialResponse> {
    const result = await this.gatehouse.createDelivery(actor, body);
    return toDeliveryCredentialResponse(result);
  }

  @Post('redeem')
  @RequirePermission(PERMISSIONS.GATEHOUSE_OPERATE)
  @Idempotent('POST /gatehouse/deliveries/redeem')
  @ApiOperation({
    summary:
      'Retirada por credencial: recebe o código ditado pelo morador ou o conteúdo do QR escaneado, localiza a entrega e confirma a retirada com foto. Requer header Idempotency-Key.',
  })
  async redeem(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(redeemDeliverySchema)) body: RedeemDeliveryInput,
  ): Promise<DeliveryResponse> {
    const delivery = await this.gatehouse.redeemDelivery(actor, body);
    return toDeliveryResponse(delivery);
  }

  @Post(':id/credential')
  @RequirePermission(PERMISSIONS.GATEHOUSE_OPERATE)
  @Idempotent('POST /gatehouse/deliveries/:id/credential')
  @ApiOperation({
    summary:
      'Reemite a credencial de retirada de uma entrega pendente (código perdido ou expirado) e reenvia pelo WhatsApp. Requer header Idempotency-Key.',
  })
  async reissueCredential(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DeliveryCredentialResponse> {
    const result = await this.gatehouse.reissuePickupCredential(actor, id);
    return toDeliveryCredentialResponse(result);
  }

}
