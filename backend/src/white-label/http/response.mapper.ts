import type { WhiteLabelConfig } from '@prisma/client';
import { visualConfigSchema, type VisualConfig } from '../dto';

export interface WhiteLabelConfigResponse {
  id: string;
  scope: string;
  scopeId: string;
  brandName: string | null;
  tagline: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  visualConfig: VisualConfig;
  updatedAt: string;
}

export function toWhiteLabelConfigResponse(c: WhiteLabelConfig): WhiteLabelConfigResponse {
  const parsed = c.visualConfig ? visualConfigSchema.safeParse(c.visualConfig) : null;
  return {
    id: c.id,
    scope: c.scope,
    scopeId: c.scopeId,
    brandName: c.brandName,
    tagline: c.tagline,
    logoUrl: c.logoUrl,
    faviconUrl: c.faviconUrl,
    primaryColor: c.primaryColor,
    secondaryColor: c.secondaryColor,
    visualConfig: parsed?.success ? parsed.data : {},
    updatedAt: c.updatedAt.toISOString(),
  };
}
