import { AuditResult } from '@prisma/client';
import { AuditService } from './audit.service';
import type { TenantScope } from '../../prisma/prisma.service';
import type { Actor } from '../../auth/actor';

/** Runs `fn`, then records a best-effort audit entry: SUCCESS with the result's id (or a custom `extractId`), FAILURE (rethrown) otherwise. */
export async function auditedOperation<T>(
  audit: AuditService,
  actor: Actor,
  scope: TenantScope,
  action: string,
  targetType: string,
  fn: () => Promise<T>,
  extractId: (result: T) => string | null = (result) => (result as { id?: string })?.id ?? null,
): Promise<T> {
  try {
    const result = await fn();
    await audit.record({
      actorUserId: actor.id,
      actorRole: actor.role,
      scope,
      action,
      targetType,
      targetId: extractId(result),
      result: AuditResult.SUCCESS,
    });
    return result;
  } catch (error) {
    await audit.record({
      actorUserId: actor.id,
      actorRole: actor.role,
      scope,
      action,
      targetType,
      result: AuditResult.FAILURE,
    });
    throw error;
  }
}
