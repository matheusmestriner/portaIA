import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { WhiteLabelService } from '../white-label.service';
import { CurrentActor } from '../../auth/http/current-actor.decorator';
import { RequirePermission } from '../../auth/http/require-permission.decorator';
import { AllowPasswordChangePending } from '../../auth/http/allow-password-change-pending.decorator';
import { PERMISSIONS } from '../../auth/rbac/permissions';
import { resolveTenantScope } from '../../auth/rbac/tenant-scope.resolver';
import { Idempotent } from '../../common/http/idempotent.decorator';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import { setWhiteLabelSchema, type SetWhiteLabelInput } from '../dto';
import type { EffectiveWhiteLabel } from '../white-label.service';
import { toWhiteLabelConfigResponse, type WhiteLabelConfigResponse } from './response.mapper';
import type { Actor } from '../../auth/actor';

@ApiTags('platform')
@ApiBearerAuth()
@Controller('platform/white-label')
export class WhiteLabelController {
  constructor(private readonly whiteLabel: WhiteLabelService) {}

  @Get()
  @AllowPasswordChangePending()
  @ApiOperation({ summary: 'Retorna a identidade visual efetiva (mesclada) para o tenant do ator autenticado.' })
  async getEffective(@CurrentActor() actor: Actor): Promise<EffectiveWhiteLabel> {
    return this.whiteLabel.getEffective(resolveTenantScope(actor));
  }

  @Put()
  @RequirePermission(PERMISSIONS.WHITE_LABEL_MANAGE)
  @Idempotent('PUT /platform/white-label')
  @ApiOperation({ summary: 'Define a identidade visual em um escopo. Requer header Idempotency-Key.' })
  async set(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(setWhiteLabelSchema)) body: SetWhiteLabelInput,
  ): Promise<WhiteLabelConfigResponse> {
    const config = await this.whiteLabel.setConfig(actor, body);
    return toWhiteLabelConfigResponse(config);
  }
}
