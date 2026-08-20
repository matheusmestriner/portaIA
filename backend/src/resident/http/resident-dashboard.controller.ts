import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ResidentService } from '../resident.service';
import { PublicRoute } from '../../auth/http/public-route.decorator';
import { ResidentJwtAuthGuard } from '../../resident-auth/http/resident-jwt-auth.guard';
import { ResidentMustChangePasswordGuard } from '../../resident-auth/http/resident-must-change-password.guard';
import { CurrentResident } from '../../resident-auth/http/current-resident.decorator';
import type { ResidentActor } from '../../resident-auth/resident-actor';

@ApiTags('resident')
@Controller('resident/dashboard')
@PublicRoute()
@UseGuards(ResidentJwtAuthGuard, ResidentMustChangePasswordGuard)
export class ResidentDashboardController {
  constructor(private readonly resident: ResidentService) {}

  @Get()
  @ApiOperation({ summary: 'Contagens da própria unidade: entregas pendentes, visitantes do mês, média de visitas por semana.' })
  async dashboard(@CurrentResident() resident: ResidentActor) {
    return this.resident.getDashboard(resident);
  }
}
