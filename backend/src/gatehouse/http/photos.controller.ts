import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { OperationalPhotosService } from '../operational-photos.service';
import { CurrentActor } from '../../auth/http/current-actor.decorator';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import type { Paginated } from '../../common/http/pagination';
import { scopeIdSchema } from '../../common/http/scope-id.schema';
import { listPhotosQuerySchema, uploadPhotoSchema, type ListPhotosQuery, type UploadPhotoInput } from '../dto';
import { toOperationalPhotoResponse, type OperationalPhotoResponse } from './response.mappers';
import type { Actor } from '../../auth/actor';

interface UploadedImage {
  buffer: Buffer;
  originalname?: string;
}

// Hard ceiling at the multer layer, before any byte reaches
// OperationalPhotosService's own MAX_UPLOAD_MB check (env.schema.ts caps
// that at 50 too) — without this, FileInterceptor buffers the entire
// multipart body in memory with no limit at all, so the "reject if too big"
// check only runs after a multi-gigabyte upload has already exhausted
// process memory.
const MULTER_MAX_FILE_BYTES = 50 * 1024 * 1024;

@ApiTags('gatehouse')
@ApiBearerAuth()
@Controller('gatehouse/photos')
export class PhotosController {
  constructor(private readonly photos: OperationalPhotosService) {}

  // Sem @RequirePermission: a checagem aceita GATEHOUSE_OPERATE OU
  // SECURITY_OPERATE (um guard de permissão única não expressa OU), então
  // ela vive no service — mesmo padrão do botão de pânico.
  @Get()
  @ApiOperation({ summary: 'Lista as fotos operacionais de um condomínio (paginado).' })
  async list(
    @CurrentActor() actor: Actor,
    @Query('condominiumId', new ZodValidationPipe(scopeIdSchema)) condominiumId: string,
    @Query(new ZodValidationPipe(listPhotosQuerySchema)) query: ListPhotosQuery,
  ): Promise<Paginated<OperationalPhotoResponse>> {
    const { category, ...pagination } = query;
    const result = await this.photos.list(actor, condominiumId, pagination, category);
    return { ...result, items: result.items.map(toOperationalPhotoResponse) };
  }

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MULTER_MAX_FILE_BYTES, files: 1 } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      'Envia a foto de um ato operacional (recebimento/retirada de entrega, chave, etc.). O tipo real da imagem é verificado pelos bytes, não pelo content-type declarado.',
  })
  async upload(
    @CurrentActor() actor: Actor,
    @UploadedFile() file: UploadedImage | undefined,
    @Body(new ZodValidationPipe(uploadPhotoSchema)) body: UploadPhotoInput,
  ): Promise<OperationalPhotoResponse> {
    if (!file?.buffer) {
      throw new BadRequestException('Envie o arquivo no campo "file"');
    }
    const parsed = uploadPhotoSchema.parse(body);
    const photo = await this.photos.upload(actor, {
      condominiumId: parsed.condominiumId,
      category: parsed.category,
      source: parsed.source,
      originalName: file.originalname,
      data: file.buffer,
    });
    return toOperationalPhotoResponse(photo);
  }

  @Get(':id/content')
  @ApiOperation({ summary: 'Devolve os bytes da foto (escopada por RLS ao condomínio do ator).' })
  async content(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const { photo, data } = await this.photos.readContent(actor, id);
    res.setHeader('Content-Type', photo.contentType);
    res.setHeader('Content-Length', String(data.byteLength));
    // Evidência operacional: nunca deve ser cacheada por proxies compartilhados.
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.end(data);
  }
}
