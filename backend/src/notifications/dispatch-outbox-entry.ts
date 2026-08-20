import { NotificationStatus, type NotificationOutboxEntry } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { TenantScope } from '../prisma/prisma.service';
import { WhatsAppAdapter } from './adapters/whatsapp.adapter';

/** Sends `message` to an outbox entry's recipient, then records the outcome on that same row — success or a honest failure reason, never a silent guess. */
export async function dispatchOutboxEntry(
  prisma: PrismaService,
  whatsApp: WhatsAppAdapter,
  scope: TenantScope,
  entry: NotificationOutboxEntry,
  message: string,
): Promise<void> {
  const result = await whatsApp.send(entry.recipient, message);
  await prisma.withTenantContext(scope, (tx) =>
    tx.notificationOutboxEntry.update({
      where: { id: entry.id },
      data: {
        status: result.success ? NotificationStatus.SENT : NotificationStatus.FAILED,
        error: result.error,
        attemptedAt: new Date(),
      },
    }),
  );
}
