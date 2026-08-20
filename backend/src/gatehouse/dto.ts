import { z } from 'zod';
import { DeliveryStatus, KeyRecordStatus, OperationalPhotoCategory } from '@prisma/client';
import { paginationQuerySchema } from '../common/http/pagination';

export const listDeliveriesQuerySchema = paginationQuerySchema.extend({
  status: z.nativeEnum(DeliveryStatus).optional(),
});
export type ListDeliveriesQuery = z.infer<typeof listDeliveriesQuerySchema>;

export const listKeyRecordsQuerySchema = paginationQuerySchema.extend({
  status: z.nativeEnum(KeyRecordStatus).optional(),
});
export type ListKeyRecordsQuery = z.infer<typeof listKeyRecordsQuerySchema>;

export const createVisitorSchema = z.object({
  unitId: z.string().uuid(),
  name: z.string().min(1).max(150),
  document: z.string().max(30).optional(),
  validFrom: z.coerce.date(),
  validUntil: z.coerce.date(),
});
export type CreateVisitorInput = z.infer<typeof createVisitorSchema>;

export const createDeliverySchema = z.object({
  unitId: z.string().uuid(),
  residentId: z.string().uuid().optional(),
  description: z.string().min(1).max(300),
  carrier: z.string().max(100).optional(),
  courierName: z.string().max(140).optional(),
  trackingCode: z.string().max(100).optional(),
  volumeCount: z.coerce.number().int().min(1).max(100).default(1),
  /** Foto do recebimento, já enviada via POST /gatehouse/photos. */
  receiptPhotoId: z.string().uuid().optional(),
});
export type CreateDeliveryInput = z.input<typeof createDeliverySchema>;

/**
 * Retirada pela credencial do morador: a portaria não escolhe a entrega, ela
 * apresenta o código (ditado) ou o conteúdo do QR (escaneado) e o backend
 * descobre a qual entrega pertence.
 */
export const redeemDeliverySchema = z.object({
  credential: z.string().min(1).max(500),
  pickedUpBy: z.string().min(1).max(140),
  pickupDocument: z.string().max(40).optional(),
  pickupPhotoId: z.string().uuid().optional(),
});
export type RedeemDeliveryInput = z.infer<typeof redeemDeliverySchema>;

export const uploadPhotoSchema = z.object({
  condominiumId: z.string().uuid(),
  category: z.nativeEnum(OperationalPhotoCategory),
  source: z.enum(['camera', 'computer']).default('camera'),
});
export type UploadPhotoInput = z.input<typeof uploadPhotoSchema>;

export const listPhotosQuerySchema = paginationQuerySchema.extend({
  category: z.nativeEnum(OperationalPhotoCategory).optional(),
});
export type ListPhotosQuery = z.infer<typeof listPhotosQuerySchema>;

export const createKeyRecordSchema = z.object({
  unitId: z.string().uuid(),
  label: z.string().min(1).max(100),
});
export type CreateKeyRecordInput = z.infer<typeof createKeyRecordSchema>;

export const checkOutKeySchema = z.object({
  keyRecordId: z.string().uuid(),
  checkedOutTo: z.string().min(1).max(150),
});
export type CheckOutKeyInput = z.infer<typeof checkOutKeySchema>;

export const checkOutKeyBodySchema = checkOutKeySchema.omit({ keyRecordId: true });
export type CheckOutKeyBody = z.infer<typeof checkOutKeyBodySchema>;
