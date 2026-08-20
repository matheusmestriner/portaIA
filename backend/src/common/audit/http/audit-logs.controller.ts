import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditQueryService } from '../audit-query.service';
import { CurrentActor } from '../../../auth/http/current-actor.decorator';
import { RequirePermission } from '../../../auth/http/require-permission.decorator';
import { PERMISSIONS } from '../../../auth/rbac/permissions';
import { ZodValidationPipe } from '../../http/zod-validation.pipe';
import { paginationQuerySchema, type PaginationQuery, type Paginated } from '../../http/pagination';
import { optionalTextFilterSchema } from '../../http/scope-id.schema';
import { toAuditLogResponse, type AuditLogResponse } from './response.mapper';
import type { Actor } from '../../../auth/actor';

@ApiTags('platform')
@ApiBearerAuth()
@Controller('platform/audit-logs')
export class AuditLogsController {
  constructor(private readonly auditQuery: AuditQueryService) {}

  @Get()
  @RequirePermission(PERMISSIONS.AUDIT_VIEW)
  @ApiOperation({ summary: 'Lista o trilho de auditoria dentro do escopo do ator (paginado, filtrável por action/targetType).' })
  async list(
    @CurrentActor() actor: Actor,
    @Query('action', new ZodValidationPipe(optionalTextFilterSchema)) action: string | undefined,
    @Query('targetType', new ZodValidationPipe(optionalTextFilterSchema)) targetType: string | undefined,
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
  ): Promise<Paginated<AuditLogResponse>> {
    const result = await this.auditQuery.list(actor, { action, targetType }, query);
    return { ...result, items: result.items.map(toAuditLogResponse) };
  }
}
