import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ExtensionsService } from '../extensions.service';
import { CurrentActor } from '../../auth/http/current-actor.decorator';
import { RequirePermission } from '../../auth/http/require-permission.decorator';
import { PERMISSIONS } from '../../auth/rbac/permissions';
import { Idempotent } from '../../common/http/idempotent.decorator';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import { paginationQuerySchema, type PaginationQuery, type Paginated } from '../../common/http/pagination';
import { scopeIdSchema } from '../../common/http/scope-id.schema';
import { createExtensionSchema, type CreateExtensionInput } from '../dto';
import { toExtensionResponse, type ExtensionResponse } from './response.mappers';
import type { Actor } from '../../auth/actor';

@ApiTags('telephony')
@ApiBearerAuth()
@Controller('telephony/extensions')
export class ExtensionsController {
  constructor(private readonly extensions: ExtensionsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.REPORTS_VIEW)
  @ApiOperation({ summary: 'Lista ramais de um condomínio (paginado).' })
  async list(
    @CurrentActor() actor: Actor,
    @Query('condominiumId', new ZodValidationPipe(scopeIdSchema)) condominiumId: string,
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
  ): Promise<Paginated<ExtensionResponse>> {
    const result = await this.extensions.listExtensions(actor, condominiumId, query);
    return { ...result, items: result.items.map(toExtensionResponse) };
  }

  @Post()
  @RequirePermission(PERMISSIONS.TELEPHONY_OPERATE)
  @Idempotent('POST /telephony/extensions')
  @ApiOperation({
    summary:
      'Cria um ramal para uma unidade. A senha SIP em texto puro só aparece nesta resposta, uma única vez. Requer header Idempotency-Key.',
  })
  async create(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(createExtensionSchema)) body: CreateExtensionInput,
  ): Promise<ExtensionResponse & { sipPassword: string }> {
    const { extension, sipPassword } = await this.extensions.createExtension(actor, body);
    return { ...toExtensionResponse(extension), sipPassword };
  }
}
