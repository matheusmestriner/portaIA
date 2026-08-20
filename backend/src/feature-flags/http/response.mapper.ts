import type { FeatureFlag } from '@prisma/client';

export interface FeatureFlagResponse {
  id: string;
  key: string;
  scope: string;
  scopeId: string;
  enabled: boolean;
  updatedAt: string;
}

export function toFeatureFlagResponse(f: FeatureFlag): FeatureFlagResponse {
  return {
    id: f.id,
    key: f.key,
    scope: f.scope,
    scopeId: f.scopeId,
    enabled: f.enabled,
    updatedAt: f.updatedAt.toISOString(),
  };
}
