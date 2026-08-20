import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SecurityService } from '../security.service';
import { CurrentActor } from '../../auth/http/current-actor.decorator';
import { Idempotent } from '../../common/http/idempotent.decorator';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import { paginationQuerySchema, type PaginationQuery, type Paginated } from '../../common/http/pagination';
import { scopeIdSchema } from '../../common/http/scope-id.schema';
import { triggerPanicAlertSchema, type TriggerPanicAlertInput } from '../dto';
import { toPanicAlertResponse, type PanicAlertResponse } from './response.mappers';
import type { Actor } from '../../auth/actor';

@ApiTags('security')
@ApiBearerAuth()
@Controller('security/panic-alerts')
export class PanicAlertsController {
  constructor(private readonly security: SecurityService) {}

  // No @RequirePermission on either route on purpose: SecurityService
  // accepts either GATEHOUSE_OPERATE or SECURITY_OPERATE for both triggering
  // and listing panic alerts, which a single-permission guard can't
  // express — the check lives in the service instead.
  @Get()
  @ApiOperation({ summary: 'Lista alertas de pânico de um condomínio (paginado).' })
  async list(
    @CurrentActor() actor: Actor,
    @Query('condominiumId', new ZodValidationPipe(scopeIdSchema)) condominiumId: string,
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
  ): Promise<Paginated<PanicAlertResponse>> {
    const result = await this.security.listPanicAlerts(actor, condominiumId, query);
    return { ...result, items: result.items.map(toPanicAlertResponse) };
  }

  @Post()
  @Idempotent('POST /security/panic-alerts')
  @ApiOperation({ summary: 'Aciona o botão de pânico. Requer header Idempotency-Key.' })
  async trigger(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(triggerPanicAlertSchema)) body: TriggerPanicAlertInput,
  ): Promise<PanicAlertResponse> {
    const alert = await this.security.triggerPanicAlert(actor, body);
    return toPanicAlertResponse(alert);
  }
}
