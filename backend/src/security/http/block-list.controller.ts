import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SecurityService } from '../security.service';
import { CurrentActor } from '../../auth/http/current-actor.decorator';
import { RequirePermission } from '../../auth/http/require-permission.decorator';
import { PERMISSIONS } from '../../auth/rbac/permissions';
import { Idempotent } from '../../common/http/idempotent.decorator';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import { paginationQuerySchema, type PaginationQuery, type Paginated } from '../../common/http/pagination';
import { scopeIdSchema } from '../../common/http/scope-id.schema';
import { addBlockListEntrySchema, type AddBlockListEntryInput } from '../dto';
import { toBlockListEntryResponse, type BlockListEntryResponse } from './response.mappers';
import type { Actor } from '../../auth/actor';

@ApiTags('security')
@ApiBearerAuth()
@Controller('security/block-list')
export class BlockListController {
  constructor(private readonly security: SecurityService) {}

  @Get()
  @RequirePermission(PERMISSIONS.SECURITY_OPERATE)
  @ApiOperation({ summary: 'Lista a lista de bloqueio de um condomínio (paginado).' })
  async list(
    @CurrentActor() actor: Actor,
    @Query('condominiumId', new ZodValidationPipe(scopeIdSchema)) condominiumId: string,
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
  ): Promise<Paginated<BlockListEntryResponse>> {
    const result = await this.security.listBlockListEntries(actor, condominiumId, query);
    return { ...result, items: result.items.map(toBlockListEntryResponse) };
  }

  @Post()
  @RequirePermission(PERMISSIONS.SECURITY_OPERATE)
  @Idempotent('POST /security/block-list')
  @ApiOperation({ summary: 'Adiciona uma entrada à lista de bloqueio. Requer header Idempotency-Key.' })
  async add(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(addBlockListEntrySchema)) body: AddBlockListEntryInput,
  ): Promise<BlockListEntryResponse> {
    const entry = await this.security.addBlockListEntry(actor, body);
    return toBlockListEntryResponse(entry);
  }
}
