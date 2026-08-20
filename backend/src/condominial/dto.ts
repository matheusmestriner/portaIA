import { z } from 'zod';

export const createUnitSchema = z.object({
  condominiumId: z.string().uuid(),
  identifier: z.string().min(1).max(50),
  block: z.string().max(50).optional(),
  floor: z.string().max(20).optional(),
});
export type CreateUnitInput = z.infer<typeof createUnitSchema>;

export const createResidentSchema = z.object({
  unitId: z.string().uuid(),
  name: z.string().min(1).max(150),
  email: z.string().email().optional(),
  phone: z.string().max(30).optional(),
  isPrimary: z.boolean().default(true),
});
export type CreateResidentInput = z.input<typeof createResidentSchema>;

export const createVehicleSchema = z.object({
  unitId: z.string().uuid(),
  plate: z
    .string()
    .min(6)
    .max(8)
    .transform((v) => v.toUpperCase().replace(/[^A-Z0-9]/g, '')),
  model: z.string().max(60).optional(),
  color: z.string().max(30).optional(),
});
export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;

export const createProviderSchema = z.object({
  condominiumId: z.string().uuid(),
  name: z.string().min(1).max(150),
  document: z
    .string()
    .min(11)
    .max(18)
    .transform((v) => v.replace(/\D/g, '')),
  company: z.string().max(150).optional(),
});
export type CreateProviderInput = z.infer<typeof createProviderSchema>;
