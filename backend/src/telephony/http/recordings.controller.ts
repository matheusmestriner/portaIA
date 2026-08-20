import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RecordingsService } from '../recordings.service';
import { CurrentActor } from '../../auth/http/current-actor.decorator';
import { RequirePermission } from '../../auth/http/require-permission.decorator';
import { PERMISSIONS } from '../../auth/rbac/permissions';
import { Idempotent } from '../../common/http/idempotent.decorator';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import { paginationQuerySchema, type PaginationQuery, type Paginated } from '../../common/http/pagination';
import { scopeIdSchema } from '../../common/http/scope-id.schema';
import { attachRecordingSchema, type AttachRecordingInput } from '../dto';
import { toRecordingResponse, type RecordingResponse } from './response.mappers';
import type { Actor } from '../../auth/actor';

@ApiTags('telephony')
@ApiBearerAuth()
@Controller('telephony/recordings')
export class RecordingsController {
  constructor(private readonly recordings: RecordingsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.REPORTS_VIEW)
  @ApiOperation({ summary: 'Lista gravações de um condomínio (paginado) — metadados apenas, sem armazenamento real de mídia na V01.' })
  async list(
    @CurrentActor() actor: Actor,
    @Query('condominiumId', new ZodValidationPipe(scopeIdSchema)) condominiumId: string,
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
  ): Promise<Paginated<RecordingResponse>> {
    const result = await this.recordings.listRecordings(actor, condominiumId, query);
    return { ...result, items: result.items.map(toRecordingResponse) };
  }

  @Post()
  @RequirePermission(PERMISSIONS.TELEPHONY_OPERATE)
  @Idempotent('POST /telephony/recordings')
  @ApiOperation({ summary: 'Anexa metadados de gravação a uma chamada. Requer header Idempotency-Key.' })
  async attach(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(attachRecordingSchema)) body: AttachRecordingInput,
  ): Promise<RecordingResponse> {
    const recording = await this.recordings.attachRecording(actor, body);
    return toRecordingResponse(recording);
  }
}
