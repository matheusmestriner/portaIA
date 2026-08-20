import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ResidentService } from '../resident.service';
import { PublicRoute } from '../../auth/http/public-route.decorator';
import { ResidentJwtAuthGuard } from '../../resident-auth/http/resident-jwt-auth.guard';
import { ResidentMustChangePasswordGuard } from '../../resident-auth/http/resident-must-change-password.guard';
import { CurrentResident } from '../../resident-auth/http/current-resident.decorator';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import { paginationQuerySchema, type PaginationQuery, type Paginated } from '../../common/http/pagination';
import { toAnnouncementResponse, type AnnouncementResponse } from '../../notifications/http/response.mappers';
import type { ResidentActor } from '../../resident-auth/resident-actor';

@ApiTags('resident')
@Controller('resident/announcements')
@PublicRoute()
@UseGuards(ResidentJwtAuthGuard, ResidentMustChangePasswordGuard)
export class ResidentAnnouncementsController {
  constructor(private readonly resident: ResidentService) {}

  @Get()
  @ApiOperation({ summary: 'Comunicados do próprio condomínio (paginado).' })
  async list(
    @CurrentResident() resident: ResidentActor,
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
  ): Promise<Paginated<AnnouncementResponse>> {
    // Passa pelo mapper como todo o resto da API: devolver a linha do Prisma
    // crua vazaria resaleId/clientId (ids de tenant acima do condomínio) para
    // o app do morador, que não tem por que conhecê-los.
    const result = await this.resident.listAnnouncements(resident, query);
    return { ...result, items: result.items.map(toAnnouncementResponse) };
  }
}
