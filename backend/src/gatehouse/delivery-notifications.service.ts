import { Injectable } from '@nestjs/common';
import { NotificationChannel, type Delivery, type Resident } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppAdapter } from '../notifications/adapters/whatsapp.adapter';
import { dispatchOutboxEntry } from '../notifications/dispatch-outbox-entry';

/**
 * Despacha o código de retirada para o morador destinatário.
 *
 * Cada tentativa vira uma linha no mesmo outbox usado pelos comunicados, com
 * o motivo da falha quando o envio não acontece — assim a portaria vê que o
 * morador não recebeu e pode ditar o código presencialmente, em vez de o
 * sistema fingir que entregou.
 */
@Injectable()
export class DeliveryNotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsApp: WhatsAppAdapter,
  ) {}

  async dispatchDeliveryPickupCode(params: {
    delivery: Delivery;
    resident: Resident;
    pickupCode: string;
  }): Promise<void> {
    const { delivery, resident, pickupCode } = params;
    if (!resident.phone) return;

    const message =
      `Olá, ${resident.name}! Uma encomenda chegou para você na portaria.\n\n` +
      `${delivery.description}\n` +
      `Código de retirada: ${pickupCode}\n\n` +
      `Apresente este código na portaria para retirar.`;

    // O escopo vem da própria entrega (é um despacho de sistema, disparado
    // logo após uma escrita já autorizada), não de um ator de requisição.
    const scope = {
      resaleId: delivery.resaleId,
      clientId: delivery.clientId,
      condominiumId: delivery.condominiumId,
    };

    const entry = await this.prisma.withTenantContext(scope, (tx) =>
      tx.notificationOutboxEntry.create({
        data: {
          resaleId: delivery.resaleId,
          clientId: delivery.clientId,
          condominiumId: delivery.condominiumId,
          channel: NotificationChannel.WHATSAPP,
          recipient: resident.phone as string,
        },
      }),
    );

    await dispatchOutboxEntry(this.prisma, this.whatsApp, scope, entry, message);
  }
}
