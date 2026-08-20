import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { CallPartyType, CallStatus, type Call, type Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { TenantScope } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { auditedOperation } from '../common/audit/audited-operation';
import { PERMISSIONS, roleHasPermission } from '../auth/rbac/permissions';
import { resolveTenantScope } from '../auth/rbac/tenant-scope.resolver';
import { paginate, type PaginationQuery, type Paginated } from '../common/http/pagination';
import type { Actor } from '../auth/actor';
import {
  originateCallSchema,
  telephonyEventSchema,
  type OriginateCallInput,
  type TelephonyEvent,
} from './dto';

type Tx = Prisma.TransactionClient;

/**
 * A unit's queue is exclusive to that unit: while its extension is busy
 * (RINGING or ANSWERED, as either side of the call), a new call targeting
 * it is born QUEUED instead of RINGING. When the active call ends, the
 * oldest QUEUED call for that same extension is promoted to RINGING — the
 * mandatory example from the spec (unit 8 talking to the gatehouse, unit 5
 * calls and waits until 8 hangs up, 5 gives up, or a timeout fires).
 *
 * No real Asterisk/AMI/ARI is connected in V01 (see docs/V01_SCOPE.md) —
 * `processEvent` is what a real bridge would call via the HMAC-authenticated
 * webhook; `originateCall` is the one action our own UI can trigger
 * directly (gatehouse calling a unit).
 */
@Injectable()
export class CallsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async originateCall(actor: Actor, input: OriginateCallInput): Promise<Call> {
    if (!roleHasPermission(actor.role, PERMISSIONS.TELEPHONY_OPERATE)) {
      throw new ForbiddenException('Papel sem permissão para originar chamadas');
    }
    const data = originateCallSchema.parse(input);
    const scope = resolveTenantScope(actor);

    return auditedOperation(this.audit, actor, scope, 'call.originate', 'Call', () =>
      this.prisma.withTenantContext(scope, async (tx) => {
        const callee = await tx.extension.findUniqueOrThrow({ where: { id: data.calleeExtensionId } });
        return this.startCall(tx, {
          resaleId: callee.resaleId,
          clientId: callee.clientId,
          condominiumId: callee.condominiumId,
          externalCallId: data.externalCallId,
          callerType: CallPartyType.GATEHOUSE,
          callerExtensionId: null,
          calleeType: CallPartyType.EXTENSION,
          calleeExtensionId: callee.id,
        });
      }),
    );
  }

  async listCalls(actor: Actor, condominiumId: string, query: PaginationQuery): Promise<Paginated<Call>> {
    const scope = resolveTenantScope(actor);
    const [items, total] = await this.prisma.withTenantContext(scope, (tx) =>
      Promise.all([
        tx.call.findMany({
          where: { condominiumId },
          orderBy: { createdAt: 'desc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        tx.call.count({ where: { condominiumId } }),
      ]),
    );
    return paginate(items, total, query);
  }

  /** Processed by the HMAC webhook, not an authenticated actor — see HmacWebhookGuard. Runs unscoped (system trust boundary), same rationale as a background job. */
  async processEvent(event: TelephonyEvent): Promise<{ callId: string | null }> {
    const parsed = telephonyEventSchema.parse(event);
    const systemScope: TenantScope = {};

    return this.prisma.withTenantContext(systemScope, async (tx) => {
      switch (parsed.type) {
        case 'CALL_STARTED': {
          const { data } = parsed;
          const callerExtension = data.caller.type === CallPartyType.EXTENSION
            ? await tx.extension.findUniqueOrThrow({ where: { id: data.caller.extensionId } })
            : null;
          const calleeExtension = data.callee.type === CallPartyType.EXTENSION
            ? await tx.extension.findUniqueOrThrow({ where: { id: data.callee.extensionId } })
            : null;
          const anchor = calleeExtension ?? callerExtension;
          if (!anchor) {
            throw new BadRequestException('Uma chamada precisa de pelo menos um lado EXTENSION');
          }

          const existing = await tx.call.findUnique({ where: { externalCallId: data.externalCallId } });
          if (existing) {
            return { callId: existing.id };
          }

          const call = await this.startCall(tx, {
            resaleId: anchor.resaleId,
            clientId: anchor.clientId,
            condominiumId: data.condominiumId,
            externalCallId: data.externalCallId,
            callerType: data.caller.type,
            callerExtensionId: callerExtension?.id ?? null,
            calleeType: data.callee.type,
            calleeExtensionId: calleeExtension?.id ?? null,
          });
          return { callId: call.id };
        }

        case 'CALL_ANSWERED': {
          const call = await tx.call.findUnique({ where: { externalCallId: parsed.data.externalCallId } });
          if (!call) {
            throw new BadRequestException(`Chamada desconhecida: ${parsed.data.externalCallId}`);
          }
          if (call.status === CallStatus.ANSWERED) {
            return { callId: call.id }; // idempotent replay
          }
          if (call.status !== CallStatus.RINGING) {
            throw new BadRequestException(`Chamada ${call.id} não está RINGING (está ${call.status})`);
          }
          await tx.call.update({ where: { id: call.id }, data: { status: CallStatus.ANSWERED, answeredAt: new Date() } });
          return { callId: call.id };
        }

        case 'CALL_ENDED': {
          const call = await tx.call.findUnique({ where: { externalCallId: parsed.data.externalCallId } });
          if (!call) {
            throw new BadRequestException(`Chamada desconhecida: ${parsed.data.externalCallId}`);
          }
          if (this.isTerminal(call.status)) {
            return { callId: call.id }; // idempotent replay
          }
          await tx.call.update({
            where: { id: call.id },
            data: { status: parsed.data.reason as CallStatus, endedAt: new Date(), endReason: parsed.data.reason },
          });
          if (call.calleeExtensionId && (call.status === CallStatus.RINGING || call.status === CallStatus.ANSWERED)) {
            await this.promoteNextQueuedCall(tx, call.calleeExtensionId);
          }
          return { callId: call.id };
        }
      }
    });
  }

  /** Explicit event for a QUEUED call whose caller gave up or whose wait exceeded policy — see class docstring on why this isn't a real timer in V01. */
  async abandonOrTimeoutQueuedCall(actor: Actor, callId: string, reason: 'ABANDONED' | 'TIMEOUT'): Promise<Call> {
    if (!roleHasPermission(actor.role, PERMISSIONS.TELEPHONY_OPERATE)) {
      throw new ForbiddenException('Papel sem permissão para operar telefonia');
    }
    const scope = resolveTenantScope(actor);
    return auditedOperation(this.audit, actor, scope, `call.${reason.toLowerCase()}`, 'Call', () =>
      this.prisma.withTenantContext(scope, async (tx) => {
        const call = await tx.call.findUniqueOrThrow({ where: { id: callId } });
        if (call.status !== CallStatus.QUEUED) {
          throw new BadRequestException(`Chamada ${callId} não está QUEUED (está ${call.status})`);
        }
        return tx.call.update({
          where: { id: callId },
          data: { status: reason as CallStatus, endedAt: new Date(), endReason: reason },
        });
      }),
    );
  }

  private async startCall(
    tx: Tx,
    params: {
      resaleId: string;
      clientId: string;
      condominiumId: string;
      externalCallId: string;
      callerType: CallPartyType;
      callerExtensionId: string | null;
      calleeType: CallPartyType;
      calleeExtensionId: string | null;
    },
  ): Promise<Call> {
    const busy = params.calleeExtensionId ? await this.isExtensionBusy(tx, params.calleeExtensionId) : false;
    const now = new Date();

    return tx.call.create({
      data: {
        resaleId: params.resaleId,
        clientId: params.clientId,
        condominiumId: params.condominiumId,
        externalCallId: params.externalCallId,
        callerType: params.callerType,
        callerExtensionId: params.callerExtensionId,
        calleeType: params.calleeType,
        calleeExtensionId: params.calleeExtensionId,
        status: busy ? CallStatus.QUEUED : CallStatus.RINGING,
        queuedAt: busy ? now : null,
        ringingAt: busy ? null : now,
      },
    });
  }

  private async isExtensionBusy(tx: Tx, extensionId: string): Promise<boolean> {
    const activeCall = await tx.call.findFirst({
      where: {
        status: { in: [CallStatus.RINGING, CallStatus.ANSWERED] },
        OR: [{ callerExtensionId: extensionId }, { calleeExtensionId: extensionId }],
      },
    });
    return activeCall !== null;
  }

  private async promoteNextQueuedCall(tx: Tx, calleeExtensionId: string): Promise<void> {
    const next = await tx.call.findFirst({
      where: { calleeExtensionId, status: CallStatus.QUEUED },
      orderBy: { createdAt: 'asc' },
    });
    if (next) {
      await tx.call.update({ where: { id: next.id }, data: { status: CallStatus.RINGING, ringingAt: new Date() } });
    }
  }

  private isTerminal(status: CallStatus): boolean {
    return (
      status === CallStatus.COMPLETED ||
      status === CallStatus.MISSED ||
      status === CallStatus.ABANDONED ||
      status === CallStatus.REJECTED ||
      status === CallStatus.TIMEOUT
    );
  }

}
