import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OperationalPhotoCategory, type OperationalPhoto } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService, MIME_EXTENSIONS } from '../common/storage/storage.service';
import { PERMISSIONS, roleHasPermission } from '../auth/rbac/permissions';
import { resolveTenantScope } from '../auth/rbac/tenant-scope.resolver';
import { paginate, type PaginationQuery, type Paginated } from '../common/http/pagination';
import type { Actor } from '../auth/actor';
import type { EnvConfig } from '../config/env.schema';

/** Assinaturas de bytes: o content-type declarado pelo cliente não é confiável. */
const MAGIC_NUMBERS: { mime: string; bytes: number[] }[] = [
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
];

/**
 * The multipart filename is client-supplied free text — it never touches a
 * filesystem path (StorageService derives its own objectKey), but it is
 * persisted and can later be rendered/logged, so control characters and
 * unbounded length don't belong in it regardless.
 */
function sanitizeOriginalName(raw: string | undefined): string | null {
  if (!raw) return null;
  // eslint-disable-next-line no-control-regex
  const stripped = raw.replace(/[\x00-\x1f\x7f]/g, '').trim();
  return stripped.length > 0 ? stripped.slice(0, 255) : null;
}

function detectImageMime(data: Buffer): string | null {
  for (const { mime, bytes } of MAGIC_NUMBERS) {
    if (bytes.every((byte, index) => data[index] === byte)) return mime;
  }
  // WebP: "RIFF"????"WEBP"
  if (data.subarray(0, 4).toString('ascii') === 'RIFF' && data.subarray(8, 12).toString('ascii') === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

@Injectable()
export class OperationalPhotosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  async upload(
    actor: Actor,
    params: {
      condominiumId: string;
      category: OperationalPhotoCategory;
      source: string;
      originalName?: string;
      data: Buffer;
    },
  ): Promise<OperationalPhoto> {
    this.assertCanOperate(actor);

    const maxBytes = this.config.get('MAX_UPLOAD_MB', { infer: true }) * 1024 * 1024;
    if (params.data.byteLength === 0) {
      throw new BadRequestException('Arquivo vazio');
    }
    if (params.data.byteLength > maxBytes) {
      throw new BadRequestException(`A imagem excede o limite de ${maxBytes / 1024 / 1024} MB`);
    }

    // Confere a assinatura real dos bytes, não o content-type informado.
    const contentType = detectImageMime(params.data);
    if (!contentType || !MIME_EXTENSIONS[contentType]) {
      throw new BadRequestException('Envie uma imagem JPEG, PNG ou WebP');
    }

    const scope = resolveTenantScope(actor);
    // A leitura escopada por RLS é o que confirma que o condomínio pertence
    // ao ator — nunca confiar no condominiumId do payload.
    const condominium = await this.prisma.withTenantContext(scope, (tx) =>
      tx.condominium.findUniqueOrThrow({ where: { id: params.condominiumId } }),
    );

    const stored = await this.storage.put({
      condominiumId: condominium.id,
      category: params.category,
      data: params.data,
      contentType,
    });

    return this.prisma.withTenantContext(scope, (tx) =>
      tx.operationalPhoto.create({
        data: {
          resaleId: condominium.resaleId,
          clientId: condominium.clientId,
          condominiumId: condominium.id,
          category: params.category,
          source: params.source,
          objectKey: stored.objectKey,
          contentType: stored.contentType,
          sizeBytes: stored.sizeBytes,
          originalName: sanitizeOriginalName(params.originalName),
          capturedByUserId: actor.id,
        },
      }),
    );
  }

  async list(
    actor: Actor,
    condominiumId: string,
    query: PaginationQuery,
    category?: OperationalPhotoCategory,
  ): Promise<Paginated<OperationalPhoto>> {
    this.assertCanOperate(actor);
    const scope = resolveTenantScope(actor);
    const where = { condominiumId, ...(category ? { category } : {}) };
    const [items, total] = await this.prisma.withTenantContext(scope, (tx) =>
      Promise.all([
        tx.operationalPhoto.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        tx.operationalPhoto.count({ where }),
      ]),
    );
    return paginate(items, total, query);
  }

  /** Devolve os bytes já com a checagem de escopo feita via RLS. */
  async readContent(actor: Actor, photoId: string): Promise<{ photo: OperationalPhoto; data: Buffer }> {
    this.assertCanOperate(actor);
    const scope = resolveTenantScope(actor);
    const photo = await this.prisma.withTenantContext(scope, (tx) =>
      tx.operationalPhoto.findUniqueOrThrow({ where: { id: photoId } }),
    );
    return { photo, data: await this.storage.get(photo.objectKey) };
  }

  private assertCanOperate(actor: Actor): void {
    const allowed = [PERMISSIONS.GATEHOUSE_OPERATE, PERMISSIONS.SECURITY_OPERATE];
    if (!allowed.some((permission) => roleHasPermission(actor.role, permission))) {
      throw new ForbiddenException('Papel sem permissão para registrar evidências fotográficas');
    }
  }
}
