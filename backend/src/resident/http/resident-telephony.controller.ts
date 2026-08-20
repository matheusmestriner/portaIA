import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ResidentService } from '../resident.service';
import { PublicRoute } from '../../auth/http/public-route.decorator';
import { ResidentJwtAuthGuard } from '../../resident-auth/http/resident-jwt-auth.guard';
import { ResidentMustChangePasswordGuard } from '../../resident-auth/http/resident-must-change-password.guard';
import { CurrentResident } from '../../resident-auth/http/current-resident.decorator';
import type { ResidentActor } from '../../resident-auth/resident-actor';

@ApiTags('resident')
@Controller('resident/telephony')
@PublicRoute()
@UseGuards(ResidentJwtAuthGuard, ResidentMustChangePasswordGuard)
export class ResidentTelephonyController {
  constructor(private readonly resident: ResidentService) {}

  @Get('credentials')
  @ApiOperation({
    summary:
      'Credenciais SIP do ramal da própria unidade, para o app registrar o softphone. ' +
      'configured:false enquanto SIP_DOMAIN não estiver configurado (nenhum Asterisk real conectado na V01).',
  })
  async credentials(@CurrentResident() resident: ResidentActor) {
    return this.resident.getTelephonyCredentials(resident);
  }
}
