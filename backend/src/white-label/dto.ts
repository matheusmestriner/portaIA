import { z } from 'zod';
import { FeatureFlagScope } from '@prisma/client';

const hexColor = (field: string) =>
  z.string().regex(/^#[0-9a-fA-F]{6}$/, `${field} deve ser um hex de 6 dígitos, ex.: #1A2B3C`);

/** Fontes permitidas — lista fechada para não injetar CSS arbitrário no tema. */
export const ALLOWED_FONTS = ['Inter', 'Manrope', 'Plus Jakarta Sans', 'Roboto', 'system-ui'] as const;

/**
 * Ajustes finos de aparência aplicados como CSS custom properties no
 * frontend. Cada campo é validado (hex fechado, fonte de uma lista fixa,
 * números com faixa) porque esses valores acabam dentro de um `style` — um
 * campo livre aqui seria injeção de CSS.
 */
export const visualConfigSchema = z
  .object({
    sidebarColor: hexColor('sidebarColor').optional(),
    topbarColor: hexColor('topbarColor').optional(),
    pageColor: hexColor('pageColor').optional(),
    cardColor: hexColor('cardColor').optional(),
    borderColor: hexColor('borderColor').optional(),
    textColor: hexColor('textColor').optional(),
    mutedTextColor: hexColor('mutedTextColor').optional(),
    successColor: hexColor('successColor').optional(),
    warningColor: hexColor('warningColor').optional(),
    dangerColor: hexColor('dangerColor').optional(),
    headingFont: z.enum(ALLOWED_FONTS).optional(),
    bodyFont: z.enum(ALLOWED_FONTS).optional(),
    baseFontSize: z.coerce.number().int().min(12).max(18).optional(),
    borderRadius: z.coerce.number().int().min(0).max(28).optional(),
    headingWeight: z.union([z.literal(500), z.literal(600), z.literal(700), z.literal(800)]).optional(),
    defaultTheme: z.enum(['light', 'dark']).optional(),
  })
  .strict();
export type VisualConfig = z.infer<typeof visualConfigSchema>;

export const setWhiteLabelSchema = z.object({
  scope: z.nativeEnum(FeatureFlagScope),
  scopeId: z.string().uuid().optional(),
  brandName: z.string().min(1).max(100).optional(),
  tagline: z.string().max(120).optional(),
  logoUrl: z.string().url().optional(),
  faviconUrl: z.string().url().optional(),
  primaryColor: hexColor('primaryColor').optional(),
  secondaryColor: hexColor('secondaryColor').optional(),
  visualConfig: visualConfigSchema.optional(),
});
export type SetWhiteLabelInput = z.infer<typeof setWhiteLabelSchema>;
