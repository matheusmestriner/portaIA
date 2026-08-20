import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PlansService } from '../plans.service';
import { CurrentActor } from '../../auth/http/current-actor.decorator';
import { RequirePermission } from '../../auth/http/require-permission.decorator';
import { PERMISSIONS } from '../../auth/rbac/permissions';
import { Idempotent } from '../../common/http/idempotent.decorator';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import { paginationQuerySchema, type PaginationQuery, type Paginated } from '../../common/http/pagination';
import { assignPlanSchema, createPlanSchema, type AssignPlanInput, type CreatePlanInput } from '../dto';
import { toPlanResponse, toResaleWithPlanResponse, type PlanResponse, type ResaleWithPlanResponse } from './response.mappers';
import type { Actor } from '../../auth/actor';

@ApiTags('platform')
@ApiBearerAuth()
@Controller('platform/plans')
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  @Get()
  @RequirePermission(PERMISSIONS.PLATFORM_MANAGE)
  @ApiOperation({ summary: 'Lista o catálogo de planos (paginado). Apenas Super Admin.' })
  async list(
    @CurrentActor() actor: Actor,
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
  ): Promise<Paginated<PlanResponse>> {
    const result = await this.plans.listPlans(actor, query);
    return { ...result, items: result.items.map(toPlanResponse) };
  }

  @Post()
  @RequirePermission(PERMISSIONS.PLATFORM_MANAGE)
  @Idempotent('POST /platform/plans')
  @ApiOperation({ summary: 'Cria um plano no catálogo. Apenas Super Admin. Requer header Idempotency-Key.' })
  async create(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(createPlanSchema)) body: CreatePlanInput,
  ): Promise<PlanResponse> {
    const plan = await this.plans.createPlan(actor, body);
    return toPlanResponse(plan);
  }

  @Post('assign')
  @RequirePermission(PERMISSIONS.PLATFORM_MANAGE)
  @Idempotent('POST /platform/plans/assign')
  @ApiOperation({
    summary: 'Provisiona (ou remove, planId=null) um plano para uma revenda. Apenas Super Admin. Requer header Idempotency-Key.',
  })
  async assign(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(assignPlanSchema)) body: AssignPlanInput,
  ): Promise<ResaleWithPlanResponse> {
    const resale = await this.plans.assignPlanToResale(actor, body);
    return toResaleWithPlanResponse(resale);
  }
}
