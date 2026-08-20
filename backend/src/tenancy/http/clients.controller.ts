import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenancyService } from '../tenancy.service';
import { CurrentActor } from '../../auth/http/current-actor.decorator';
import { RequirePermission } from '../../auth/http/require-permission.decorator';
import { PERMISSIONS } from '../../auth/rbac/permissions';
import { Idempotent } from '../../common/http/idempotent.decorator';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import { paginationQuerySchema, type PaginationQuery, type Paginated } from '../../common/http/pagination';
import { scopeIdSchema } from '../../common/http/scope-id.schema';
import { createClientSchema, type CreateClientInput } from '../dto';
import { toClientResponse, type ClientResponse } from './response.mappers';
import type { Actor } from '../../auth/actor';

@ApiTags('platform')
@ApiBearerAuth()
@Controller('platform/clients')
export class ClientsController {
  constructor(private readonly tenancy: TenancyService) {}

  @Get()
  @RequirePermission(PERMISSIONS.REPORTS_VIEW)
  @ApiOperation({ summary: 'Lista clientes de uma revenda (paginado).' })
  async list(
    @CurrentActor() actor: Actor,
    @Query('resaleId', new ZodValidationPipe(scopeIdSchema)) resaleId: string,
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
  ): Promise<Paginated<ClientResponse>> {
    const result = await this.tenancy.listClients(actor, resaleId, query);
    return { ...result, items: result.items.map(toClientResponse) };
  }

  @Post()
  @RequirePermission(PERMISSIONS.RESALE_MANAGE)
  @Idempotent('POST /platform/clients')
  @ApiOperation({ summary: 'Cria um cliente sob uma revenda. Requer header Idempotency-Key.' })
  async create(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(createClientSchema)) body: CreateClientInput,
  ): Promise<ClientResponse> {
    const client = await this.tenancy.createClient(actor, body);
    return toClientResponse(client);
  }
}
