import { z } from 'zod';

const slugSchema = z
  .string()
  .min(2)
  .max(60)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'slug deve ser kebab-case (letras minúsculas, números e hífens)');

export const createResaleSchema = z.object({
  name: z.string().min(1).max(150),
  slug: slugSchema,
});
export type CreateResaleInput = z.infer<typeof createResaleSchema>;

export const createClientSchema = z.object({
  // Ignorado quando o ator não é SUPER_ADMIN: o resaleId efetivo vem sempre
  // do escopo do ator autenticado, nunca do payload (ver TenancyService).
  resaleId: z.string().uuid().optional(),
  name: z.string().min(1).max(150),
  slug: slugSchema,
});
export type CreateClientInput = z.infer<typeof createClientSchema>;

export const createCondominiumSchema = z.object({
  // Ignorado quando o ator é CLIENT_ADMIN/CLIENT_OPERATOR: o clientId
  // efetivo vem do escopo do ator (mesma regra do resaleId acima).
  clientId: z.string().uuid().optional(),
  name: z.string().min(1).max(150),
  slug: slugSchema,
});
export type CreateCondominiumInput = z.infer<typeof createCondominiumSchema>;
