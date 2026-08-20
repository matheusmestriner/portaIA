import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FeatureFlagsService } from '../feature-flags.service';
import { CurrentActor } from '../../auth/http/current-actor.decorator';
import { RequirePermission } from '../../auth/http/require-permission.decorator';
import { PERMISSIONS } from '../../auth/rbac/permissions';
import { Idempotent } from '../../common/http/idempotent.decorator';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import { setFeatureFlagSchema, type SetFeatureFlagInput } from '../dto';
import { toFeatureFlagResponse, type FeatureFlagResponse } from './response.mapper';
import type { Actor } from '../../auth/actor';

@ApiTags('platform')
@ApiBearerAuth()
@Controller('platform/feature-flags')
export class FeatureFlagsController {
  constructor(private readonly featureFlags: FeatureFlagsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.FEATURE_FLAG_MANAGE)
  @ApiOperation({ summary: 'Lista todas as configurações de feature flag (todos os escopos).' })
  async list(@CurrentActor() actor: Actor): Promise<FeatureFlagResponse[]> {
    const flags = await this.featureFlags.listForScope(actor);
    return flags.map(toFeatureFlagResponse);
  }

  @Put()
  @RequirePermission(PERMISSIONS.FEATURE_FLAG_MANAGE)
  @Idempotent('PUT /platform/feature-flags')
  @ApiOperation({
    summary:
      'Define o valor de uma feature flag em um escopo. Requer header Idempotency-Key.',
  })
  async set(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(setFeatureFlagSchema)) body: SetFeatureFlagInput,
  ): Promise<FeatureFlagResponse> {
    const flag = await this.featureFlags.setFlag(actor, body.key, body.scope, body.scopeId, body.enabled);
    return toFeatureFlagResponse(flag);
  }
}
