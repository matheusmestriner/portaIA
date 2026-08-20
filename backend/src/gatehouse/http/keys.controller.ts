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
  checkOutKeyBodySchema,
  createKeyRecordSchema,
  listKeyRecordsQuerySchema,
  type CheckOutKeyBody,
  type CreateKeyRecordInput,
  type ListKeyRecordsQuery,
} from '../dto';
import { toKeyRecordResponse, type KeyRecordResponse } from './response.mappers';
import type { Actor } from '../../auth/actor';

@ApiTags('gatehouse')
@ApiBearerAuth()
@Controller('gatehouse/keys')
export class KeysController {
  constructor(private readonly gatehouse: GatehouseService) {}

  @Get()
  @RequirePermission(PERMISSIONS.GATEHOUSE_OPERATE)
  @ApiOperation({ summary: 'Lista chaves/objetos de um condomínio (paginado), com filtro opcional de status.' })
  async list(
    @CurrentActor() actor: Actor,
    @Query('condominiumId', new ZodValidationPipe(scopeIdSchema)) condominiumId: string,
    @Query(new ZodValidationPipe(listKeyRecordsQuerySchema)) query: ListKeyRecordsQuery,
  ): Promise<Paginated<KeyRecordResponse>> {
    const { status, ...pagination } = query;
    const result = await this.gatehouse.listKeyRecords(actor, condominiumId, pagination, status);
    return { ...result, items: result.items.map(toKeyRecordResponse) };
  }

  @Post()
  @RequirePermission(PERMISSIONS.GATEHOUSE_OPERATE)
  @Idempotent('POST /gatehouse/keys')
  @ApiOperation({ summary: 'Cadastra uma chave/objeto sob controle da portaria. Requer header Idempotency-Key.' })
  async create(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(createKeyRecordSchema)) body: CreateKeyRecordInput,
  ): Promise<KeyRecordResponse> {
    const key = await this.gatehouse.createKeyRecord(actor, body);
    return toKeyRecordResponse(key);
  }

  @Post(':id/check-out')
  @RequirePermission(PERMISSIONS.GATEHOUSE_OPERATE)
  @Idempotent('POST /gatehouse/keys/:id/check-out')
  @ApiOperation({ summary: 'Registra a retirada de uma chave. Requer header Idempotency-Key.' })
  async checkOut(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(checkOutKeyBodySchema)) body: CheckOutKeyBody,
  ): Promise<KeyRecordResponse> {
    const key = await this.gatehouse.checkOutKey(actor, { keyRecordId: id, checkedOutTo: body.checkedOutTo });
    return toKeyRecordResponse(key);
  }

  @Post(':id/return')
  @RequirePermission(PERMISSIONS.GATEHOUSE_OPERATE)
  @Idempotent('POST /gatehouse/keys/:id/return')
  @ApiOperation({ summary: 'Registra a devolução de uma chave. Requer header Idempotency-Key.' })
  async returnKey(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<KeyRecordResponse> {
    const key = await this.gatehouse.returnKey(actor, id);
    return toKeyRecordResponse(key);
  }
}
