import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NotificationsService } from '../notifications.service';
import { CurrentActor } from '../../auth/http/current-actor.decorator';
import { RequirePermission } from '../../auth/http/require-permission.decorator';
import { PERMISSIONS } from '../../auth/rbac/permissions';
import { Idempotent } from '../../common/http/idempotent.decorator';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import { paginationQuerySchema, type PaginationQuery, type Paginated } from '../../common/http/pagination';
import { scopeIdSchema } from '../../common/http/scope-id.schema';
import { createAnnouncementSchema, type CreateAnnouncementInput } from '../dto';
import {
  toAnnouncementResponse,
  toOutboxEntryResponse,
  type AnnouncementResponse,
  type OutboxEntryResponse,
} from './response.mappers';
import type { Actor } from '../../auth/actor';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get('whatsapp/status')
  @ApiOperation({ summary: 'Status da conexão WhatsApp (V01 não integra um provedor real — sempre desconectado).' })
  status(): { connected: boolean; reason?: string } {
    return this.notifications.whatsAppStatus();
  }

  @Get('announcements')
  @RequirePermission(PERMISSIONS.REPORTS_VIEW)
  @ApiOperation({ summary: 'Lista comunicados de um condomínio (paginado).' })
  async listAnnouncements(
    @CurrentActor() actor: Actor,
    @Query('condominiumId', new ZodValidationPipe(scopeIdSchema)) condominiumId: string,
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
  ): Promise<Paginated<AnnouncementResponse>> {
    const result = await this.notifications.listAnnouncements(actor, condominiumId, query);
    return { ...result, items: result.items.map(toAnnouncementResponse) };
  }

  @Post('announcements')
  @RequirePermission(PERMISSIONS.COMMUNICATION_MANAGE)
  @Idempotent('POST /notifications/announcements')
  @ApiOperation({
    summary:
      'Cria um comunicado e enfileira o disparo por WhatsApp para os moradores com telefone cadastrado. Requer header Idempotency-Key.',
  })
  async createAnnouncement(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(createAnnouncementSchema)) body: CreateAnnouncementInput,
  ): Promise<{ announcement: AnnouncementResponse; queued: number }> {
    const { announcement, queued } = await this.notifications.createAnnouncement(actor, body);
    return { announcement: toAnnouncementResponse(announcement), queued };
  }

  @Get('outbox')
  @RequirePermission(PERMISSIONS.REPORTS_VIEW)
  @ApiOperation({ summary: 'Lista o outbox de notificações de um condomínio (paginado) — status de cada tentativa de envio.' })
  async listOutbox(
    @CurrentActor() actor: Actor,
    @Query('condominiumId', new ZodValidationPipe(scopeIdSchema)) condominiumId: string,
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
  ): Promise<Paginated<OutboxEntryResponse>> {
    const result = await this.notifications.listOutboxEntries(actor, condominiumId, query);
    return { ...result, items: result.items.map(toOutboxEntryResponse) };
  }
}
