import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CallsService } from '../calls.service';
import { CurrentActor } from '../../auth/http/current-actor.decorator';
import { RequirePermission } from '../../auth/http/require-permission.decorator';
import { PERMISSIONS } from '../../auth/rbac/permissions';
import { Idempotent } from '../../common/http/idempotent.decorator';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import { paginationQuerySchema, type PaginationQuery, type Paginated } from '../../common/http/pagination';
import { scopeIdSchema } from '../../common/http/scope-id.schema';
import { originateCallSchema, type OriginateCallInput } from '../dto';
import { toCallResponse, type CallResponse } from './response.mappers';
import type { Actor } from '../../auth/actor';

@ApiTags('telephony')
@ApiBearerAuth()
@Controller('telephony/calls')
export class CallsController {
  constructor(private readonly calls: CallsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.REPORTS_VIEW)
  @ApiOperation({ summary: 'Lista chamadas de um condomínio (paginado).' })
  async list(
    @CurrentActor() actor: Actor,
    @Query('condominiumId', new ZodValidationPipe(scopeIdSchema)) condominiumId: string,
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
  ): Promise<Paginated<CallResponse>> {
    const result = await this.calls.listCalls(actor, condominiumId, query);
    return { ...result, items: result.items.map(toCallResponse) };
  }

  @Post()
  @RequirePermission(PERMISSIONS.TELEPHONY_OPERATE)
  @Idempotent('POST /telephony/calls')
  @ApiOperation({
    summary:
      'Origina uma chamada da portaria para uma unidade. Entra na fila FIFO daquela unidade se o ramal já estiver ocupado. Requer header Idempotency-Key.',
  })
  async originate(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(originateCallSchema)) body: OriginateCallInput,
  ): Promise<CallResponse> {
    const call = await this.calls.originateCall(actor, body);
    return toCallResponse(call);
  }

  @Post(':id/abandon')
  @RequirePermission(PERMISSIONS.TELEPHONY_OPERATE)
  @Idempotent('POST /telephony/calls/:id/abandon')
  @ApiOperation({ summary: 'Marca uma chamada em fila (QUEUED) como desistência do chamador. Requer header Idempotency-Key.' })
  async abandon(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string): Promise<CallResponse> {
    const call = await this.calls.abandonOrTimeoutQueuedCall(actor, id, 'ABANDONED');
    return toCallResponse(call);
  }

  @Post(':id/timeout')
  @RequirePermission(PERMISSIONS.TELEPHONY_OPERATE)
  @Idempotent('POST /telephony/calls/:id/timeout')
  @ApiOperation({ summary: 'Marca uma chamada em fila (QUEUED) como estourada por timeout de espera. Requer header Idempotency-Key.' })
  async timeout(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string): Promise<CallResponse> {
    const call = await this.calls.abandonOrTimeoutQueuedCall(actor, id, 'TIMEOUT');
    return toCallResponse(call);
  }
}
