import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ResidentService } from '../resident.service';
import { PublicRoute } from '../../auth/http/public-route.decorator';
import { ResidentJwtAuthGuard } from '../../resident-auth/http/resident-jwt-auth.guard';
import { ResidentMustChangePasswordGuard } from '../../resident-auth/http/resident-must-change-password.guard';
import { ResidentAllowPasswordChangePending } from '../../resident-auth/http/resident-allow-password-change-pending.decorator';
import { CurrentResident } from '../../resident-auth/http/current-resident.decorator';
import { toResidentMeResponse } from './response.mappers';
import type { ResidentActor } from '../../resident-auth/resident-actor';

@ApiTags('resident')
@Controller('resident/me')
@PublicRoute()
@UseGuards(ResidentJwtAuthGuard, ResidentMustChangePasswordGuard)
export class ResidentProfileController {
  constructor(private readonly resident: ResidentService) {}

  @Get()
  @ResidentAllowPasswordChangePending()
  @ApiOperation({ summary: 'Dados do morador autenticado, com unidade e condomínio. Acessível mesmo com troca de senha pendente.' })
  async me(@CurrentResident() resident: ResidentActor) {
    const data = await this.resident.getMe(resident);
    return toResidentMeResponse(data);
  }
}
