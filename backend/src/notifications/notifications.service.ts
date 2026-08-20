import { ForbiddenException, Injectable } from '@nestjs/common';
import { NotificationChannel, type Announcement, type NotificationOutboxEntry } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { auditedOperation } from '../common/audit/audited-operation';
import { PERMISSIONS, roleHasPermission } from '../auth/rbac/permissions';
import { resolveTenantScope } from '../auth/rbac/tenant-scope.resolver';
import { paginate, type PaginationQuery, type Paginated } from '../common/http/pagination';
import type { Actor } from '../auth/actor';
import { WhatsAppAdapter } from './adapters/whatsapp.adapter';
import { dispatchOutboxEntry } from './dispatch-outbox-entry';
import { createAnnouncementSchema, type CreateAnnouncementInput } from './dto';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly whatsApp: WhatsAppAdapter,
  ) {}

  /**
   * Creates the announcement, fans it out to every resident of the
   * condominium with a phone on file (one WHATSAPP outbox entry each), then
   * attempts to dispatch each entry through the adapter. With no real
   * provider configured for V01, every attempt fails honestly and the
   * reason is recorded — nothing is declared "sent" that wasn't.
   */
  async createAnnouncement(
    actor: Actor,
    input: CreateAnnouncementInput,
  ): Promise<{ announcement: Announcement; queued: number }> {
    this.assertCanManage(actor);
    const data = createAnnouncementSchema.parse(input);
    const scope = resolveTenantScope(actor);

    const { announcement, entries } = await auditedOperation(this.audit,
      actor,
      scope,
      'announcement.create',
      'Announcement',
      () =>
        this.prisma.withTenantContext(scope, async (tx) => {
          const condominium = await tx.condominium.findUniqueOrThrow({ where: { id: data.condominiumId } });

          const created = await tx.announcement.create({
            data: {
              condominiumId: condominium.id,
              resaleId: condominium.resaleId,
              clientId: condominium.clientId,
              title: data.title,
              body: data.body,
              createdBy: actor.id,
            },
          });

          const recipients = await tx.resident.findMany({
            where: { condominiumId: condominium.id, isActive: true, phone: { not: null } },
            select: { phone: true },
          });

          const outboxEntries: NotificationOutboxEntry[] = [];
          for (const recipient of recipients) {
            const entry = await tx.notificationOutboxEntry.create({
              data: {
                announcementId: created.id,
                resaleId: condominium.resaleId,
                clientId: condominium.clientId,
                condominiumId: condominium.id,
                channel: NotificationChannel.WHATSAPP,
                recipient: recipient.phone as string,
              },
            });
            outboxEntries.push(entry);
          }

          return { announcement: created, entries: outboxEntries };
        }),
      (result) => result.announcement.id,
    );

    for (const entry of entries) {
      await dispatchOutboxEntry(this.prisma, this.whatsApp, scope, entry, `${announcement.title}\n\n${announcement.body}`);
    }

    return { announcement, queued: entries.length };
  }

  async listAnnouncements(actor: Actor, condominiumId: string, query: PaginationQuery): Promise<Paginated<Announcement>> {
    const scope = resolveTenantScope(actor);
    const [items, total] = await this.prisma.withTenantContext(scope, (tx) =>
      Promise.all([
        tx.announcement.findMany({
          where: { condominiumId },
          orderBy: { createdAt: 'desc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        tx.announcement.count({ where: { condominiumId } }),
      ]),
    );
    return paginate(items, total, query);
  }

  async listOutboxEntries(
    actor: Actor,
    condominiumId: string,
    query: PaginationQuery,
  ): Promise<Paginated<NotificationOutboxEntry>> {
    const scope = resolveTenantScope(actor);
    const [items, total] = await this.prisma.withTenantContext(scope, (tx) =>
      Promise.all([
        tx.notificationOutboxEntry.findMany({
          where: { condominiumId },
          orderBy: { createdAt: 'desc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        tx.notificationOutboxEntry.count({ where: { condominiumId } }),
      ]),
    );
    return paginate(items, total, query);
  }

  whatsAppStatus(): { connected: boolean; reason?: string } {
    if (this.whatsApp.isConfigured()) {
      return { connected: true };
    }
    return { connected: false, reason: 'Adapter WhatsApp não configurado nesta instalação (V01).' };
  }

  private assertCanManage(actor: Actor): void {
    if (!roleHasPermission(actor.role, PERMISSIONS.COMMUNICATION_MANAGE)) {
      throw new ForbiddenException('Papel sem permissão para gerenciar comunicados');
    }
  }

}
