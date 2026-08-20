import { ForbiddenException, Injectable } from '@nestjs/common';
import { type Extension } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { auditedOperation } from '../common/audit/audited-operation';
import { PERMISSIONS, roleHasPermission } from '../auth/rbac/permissions';
import { resolveTenantScope } from '../auth/rbac/tenant-scope.resolver';
import { paginate, type PaginationQuery, type Paginated } from '../common/http/pagination';
import type { Actor } from '../auth/actor';
import type { EnvConfig } from '../config/env.schema';
import { createExtensionSchema, type CreateExtensionInput } from './dto';
import { encryptSipPassword, generateSipPassword } from './sip-credential.crypto';

export interface ExtensionWithPlainPassword {
  extension: Extension;
  sipPassword: string;
}

@Injectable()
export class ExtensionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  /**
   * The plaintext SIP password is returned ONCE, in this response — it is
   * never retrievable again afterwards (only the encrypted form is stored).
   * Same one-time-secret pattern as an API key.
   */
  async createExtension(actor: Actor, input: CreateExtensionInput): Promise<ExtensionWithPlainPassword> {
    this.assertCanOperate(actor);
    const data = createExtensionSchema.parse(input);
    const scope = resolveTenantScope(actor);

    const plainPassword = generateSipPassword();
    const encryptedPassword = encryptSipPassword(plainPassword, this.config.get('TELEPHONY_SIP_SECRET_KEY', { infer: true }));

    const extension = await auditedOperation(this.audit, actor, scope, 'extension.create', 'Extension', () =>
      this.prisma.withTenantContext(scope, async (tx) => {
        const unit = await tx.unit.findUniqueOrThrow({ where: { id: data.unitId } });
        return tx.extension.create({
          data: {
            unitId: unit.id,
            resaleId: unit.resaleId,
            clientId: unit.clientId,
            condominiumId: unit.condominiumId,
            number: data.number,
            sipUsername: data.number,
            sipPasswordEncrypted: encryptedPassword,
          },
        });
      }),
    );

    return { extension, sipPassword: plainPassword };
  }

  async listExtensions(actor: Actor, condominiumId: string, query: PaginationQuery): Promise<Paginated<Extension>> {
    const scope = resolveTenantScope(actor);
    const [items, total] = await this.prisma.withTenantContext(scope, (tx) =>
      Promise.all([
        tx.extension.findMany({
          where: { condominiumId },
          orderBy: { number: 'asc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        tx.extension.count({ where: { condominiumId } }),
      ]),
    );
    return paginate(items, total, query);
  }

  private assertCanOperate(actor: Actor): void {
    if (!roleHasPermission(actor.role, PERMISSIONS.TELEPHONY_OPERATE)) {
      throw new ForbiddenException('Papel sem permissão para gerenciar ramais');
    }
  }

}
