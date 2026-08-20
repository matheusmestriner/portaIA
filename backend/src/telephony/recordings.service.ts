import { ForbiddenException, Injectable } from '@nestjs/common';
import { type Recording } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { auditedOperation } from '../common/audit/audited-operation';
import { PERMISSIONS, roleHasPermission } from '../auth/rbac/permissions';
import { resolveTenantScope } from '../auth/rbac/tenant-scope.resolver';
import { paginate, type PaginationQuery, type Paginated } from '../common/http/pagination';
import type { Actor } from '../auth/actor';
import { attachRecordingSchema, type AttachRecordingInput } from './dto';

/**
 * Metadata only — V01 does not integrate real private object storage
 * (MinIO/S3 not configured this session). storageKey is where the audio
 * *would* live in a private bucket once that integration exists; nothing
 * here uploads or serves an actual file. See docs/V01_SCOPE.md.
 */
@Injectable()
export class RecordingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async attachRecording(actor: Actor, input: AttachRecordingInput): Promise<Recording> {
    if (!roleHasPermission(actor.role, PERMISSIONS.TELEPHONY_OPERATE)) {
      throw new ForbiddenException('Papel sem permissão para anexar gravações');
    }
    const data = attachRecordingSchema.parse(input);
    const scope = resolveTenantScope(actor);

    return auditedOperation(this.audit, actor, scope, 'recording.attach', 'Recording', () =>
      this.prisma.withTenantContext(scope, async (tx) => {
        const call = await tx.call.findUniqueOrThrow({ where: { id: data.callId } });
        const retentionUntil = data.retentionDays
          ? new Date(Date.now() + data.retentionDays * 24 * 60 * 60 * 1000)
          : null;
        return tx.recording.create({
          data: {
            callId: call.id,
            resaleId: call.resaleId,
            clientId: call.clientId,
            condominiumId: call.condominiumId,
            storageKey: data.storageKey,
            checksum: data.checksum,
            sizeBytes: data.sizeBytes,
            durationSeconds: data.durationSeconds,
            retentionUntil,
          },
        });
      }),
    );
  }

  async listRecordings(actor: Actor, condominiumId: string, query: PaginationQuery): Promise<Paginated<Recording>> {
    const scope = resolveTenantScope(actor);
    const [items, total] = await this.prisma.withTenantContext(scope, (tx) =>
      Promise.all([
        tx.recording.findMany({
          where: { condominiumId },
          orderBy: { createdAt: 'desc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        tx.recording.count({ where: { condominiumId } }),
      ]),
    );
    return paginate(items, total, query);
  }

}
