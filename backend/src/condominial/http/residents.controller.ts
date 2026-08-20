import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CondominialService } from '../condominial.service';
import { CurrentActor } from '../../auth/http/current-actor.decorator';
import { RequirePermission } from '../../auth/http/require-permission.decorator';
import { PERMISSIONS } from '../../auth/rbac/permissions';
import { Idempotent } from '../../common/http/idempotent.decorator';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import { paginationQuerySchema, type PaginationQuery, type Paginated } from '../../common/http/pagination';
import { optionalScopeIdSchema } from '../../common/http/scope-id.schema';
import { createResidentSchema, type CreateResidentInput } from '../dto';
import { toResidentResponse, type ResidentResponse } from './response.mappers';
import type { Actor } from '../../auth/actor';

@ApiTags('condominial')
@ApiBearerAuth()
@Controller('condominial/residents')
export class ResidentsController {
  constructor(private readonly condominial: CondominialService) {}

  // Sem @RequirePermission: a checagem aceita qualquer permissão operacional
  // de nível condomínio (a portaria precisa escolher o destinatário de uma
  // entrega), o que um guard de permissão única não expressa.
  @Get()
  @ApiOperation({ summary: 'Lista moradores de uma unidade ou de um condomínio inteiro (paginado).' })
  async list(
    @CurrentActor() actor: Actor,
    @Query('unitId', new ZodValidationPipe(optionalScopeIdSchema)) unitId: string | undefined,
    @Query('condominiumId', new ZodValidationPipe(optionalScopeIdSchema)) condominiumId: string | undefined,
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
  ): Promise<Paginated<ResidentResponse>> {
    const result = await this.condominial.listResidents(actor, { unitId, condominiumId }, query);
    return { ...result, items: result.items.map(toResidentResponse) };
  }

  @Post()
  @RequirePermission(PERMISSIONS.CONDOMINIUM_MANAGE)
  @Idempotent('POST /condominial/residents')
  @ApiOperation({
    summary:
      'Cadastra um morador. Requer header Idempotency-Key. Se um email for informado, devolve a senha temporária ' +
      'de login do app do morador em claro, uma única vez — repasse por um canal seguro (WhatsApp, impresso).',
  })
  async create(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(createResidentSchema)) body: CreateResidentInput,
  ): Promise<ResidentResponse & { temporaryPassword: string | null }> {
    const { resident, temporaryPassword } = await this.condominial.createResident(actor, body);
    return { ...toResidentResponse(resident), temporaryPassword };
  }
}
