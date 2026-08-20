import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReportsService, type CallsReport, type CountByGroup, type OverviewReport } from '../reports.service';
import { CurrentActor } from '../../auth/http/current-actor.decorator';
import { RequirePermission } from '../../auth/http/require-permission.decorator';
import { PERMISSIONS } from '../../auth/rbac/permissions';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import { scopeIdSchema } from '../../common/http/scope-id.schema';
import { condominiumReportQuerySchema, type CondominiumReportQuery } from '../dto';
import type { Actor } from '../../auth/actor';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
@RequirePermission(PERMISSIONS.REPORTS_VIEW)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Visão geral do condomínio: contagens operacionais correntes.' })
  async overview(
    @CurrentActor() actor: Actor,
    @Query('condominiumId', new ZodValidationPipe(scopeIdSchema)) condominiumId: string,
  ): Promise<OverviewReport> {
    return this.reports.overview(actor, condominiumId);
  }

  @Get('deliveries')
  @ApiOperation({ summary: 'Entregas por status, no período informado.' })
  async deliveries(
    @CurrentActor() actor: Actor,
    @Query(new ZodValidationPipe(condominiumReportQuerySchema)) query: CondominiumReportQuery,
  ): Promise<CountByGroup> {
    return this.reports.deliveriesByStatus(actor, query);
  }

  @Get('occurrences')
  @ApiOperation({ summary: 'Ocorrências por severidade, no período informado.' })
  async occurrences(
    @CurrentActor() actor: Actor,
    @Query(new ZodValidationPipe(condominiumReportQuerySchema)) query: CondominiumReportQuery,
  ): Promise<CountByGroup> {
    return this.reports.occurrencesBySeverity(actor, query);
  }

  @Get('visitors')
  @ApiOperation({ summary: 'Autorizações de visitantes por status, no período informado.' })
  async visitors(
    @CurrentActor() actor: Actor,
    @Query(new ZodValidationPipe(condominiumReportQuerySchema)) query: CondominiumReportQuery,
  ): Promise<CountByGroup> {
    return this.reports.visitorAuthorizationsByStatus(actor, query);
  }

  @Get('calls')
  @ApiOperation({
    summary:
      'Chamadas da portaria por status (atendidas/perdidas/rejeitadas/abandonadas/timeout/na fila), com tempo médio de espera e de conversa, no período informado.',
  })
  async calls(
    @CurrentActor() actor: Actor,
    @Query(new ZodValidationPipe(condominiumReportQuerySchema)) query: CondominiumReportQuery,
  ): Promise<CallsReport> {
    return this.reports.callsReport(actor, query);
  }

  @Get('providers')
  @ApiOperation({ summary: 'Prestadores ativos/inativos do condomínio.' })
  async providers(
    @CurrentActor() actor: Actor,
    @Query('condominiumId', new ZodValidationPipe(scopeIdSchema)) condominiumId: string,
  ): Promise<CountByGroup> {
    return this.reports.activeProvidersCount(actor, condominiumId);
  }
}
