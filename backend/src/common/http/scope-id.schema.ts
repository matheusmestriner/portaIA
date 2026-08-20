import { z } from 'zod';

/**
 * For every `@Query('xId') xId: string` scope-id param across the app —
 * that annotation is TypeScript-only, not runtime validation. Express's
 * default query parser (`qs`) turns bracket notation (`?xId[not]=y`) into a
 * nested object instead of a string, which Prisma's typed client then
 * happily accepts as a StringFilter operator. RLS is the real isolation
 * boundary and contains the blast radius (an actor can only ever affect
 * rows already inside their own tenant tree), but this closes the
 * mechanical vector as defense in depth: a malformed/object value now fails
 * validation before reaching a service.
 */
export const scopeIdSchema = z.string().uuid();
export const optionalScopeIdSchema = z.string().uuid().optional();

/** Same rationale, for free-text query filters (not UUIDs) passed straight through to a `where`. */
export const optionalTextFilterSchema = z.string().max(100).optional();
