import { z } from 'zod';

export const paginationQuerySchema = z.object({
  // Capped: an unbounded page number turns into an unbounded SQL OFFSET,
  // which Postgres still has to scan past even when the result is empty —
  // cheap for the caller to request, expensive for the database to run.
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export function paginate<T>(items: T[], total: number, query: PaginationQuery): Paginated<T> {
  return { items, page: query.page, pageSize: query.pageSize, total };
}
