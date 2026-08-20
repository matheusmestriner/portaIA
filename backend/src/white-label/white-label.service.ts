import { ForbiddenException, Injectable } from '@nestjs/common';
import { FeatureFlagScope, type WhiteLabelConfig } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { TenantScope } from '../prisma/prisma.service';
import { PERMISSIONS, roleHasPermission } from '../auth/rbac/permissions';
import { resolveWritableScopeId } from '../auth/rbac/scope-authorization';
import type { Actor } from '../auth/actor';
import { visualConfigSchema, type SetWhiteLabelInput, type VisualConfig } from './dto';

export interface EffectiveWhiteLabel {
  brandName: string | null;
  tagline: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  visualConfig: VisualConfig;
}

const BRANDABLE_FIELDS = [
  'brandName',
  'tagline',
  'logoUrl',
  'faviconUrl',
  'primaryColor',
  'secondaryColor',
] as const;

@Injectable()
export class WhiteLabelService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Field-level merge from least to most specific (GLOBAL -> RESALE ->
   * CLIENT -> CONDOMINIUM): a condominium that only overrides its logo
   * still inherits the resale's colors, rather than an all-or-nothing row
   * pick like feature flags. Unset fields stay null (caller falls back to
   * the product's own defaults).
   */
  async getEffective(scope: TenantScope): Promise<EffectiveWhiteLabel> {
    const candidates: Array<{ scope: FeatureFlagScope; scopeId: string }> = [
      { scope: FeatureFlagScope.GLOBAL, scopeId: '' },
    ];
    if (scope.resaleId) candidates.push({ scope: FeatureFlagScope.RESALE, scopeId: scope.resaleId });
    if (scope.clientId) candidates.push({ scope: FeatureFlagScope.CLIENT, scopeId: scope.clientId });
    if (scope.condominiumId) candidates.push({ scope: FeatureFlagScope.CONDOMINIUM, scopeId: scope.condominiumId });

    const rows = await this.prisma.whiteLabelConfig.findMany({
      where: { OR: candidates.map((c) => ({ scope: c.scope, scopeId: c.scopeId })) },
    });

    const result: EffectiveWhiteLabel = {
      brandName: null,
      tagline: null,
      logoUrl: null,
      faviconUrl: null,
      primaryColor: null,
      secondaryColor: null,
      visualConfig: {},
    };
    for (const candidate of candidates) {
      const row = rows.find((r) => r.scope === candidate.scope && r.scopeId === candidate.scopeId);
      if (!row) continue;
      for (const field of BRANDABLE_FIELDS) {
        if (row[field] != null) {
          result[field] = row[field];
        }
      }
      // visualConfig funde token a token, na mesma lógica do resto: um
      // condomínio que só troca a cor da sidebar mantém o restante do tema
      // herdado da revenda. Revalidado na leitura porque o JSON pode ter sido
      // gravado por uma versão anterior do schema.
      if (row.visualConfig) {
        const parsed = visualConfigSchema.safeParse(row.visualConfig);
        if (parsed.success) {
          result.visualConfig = { ...result.visualConfig, ...parsed.data };
        }
      }
    }
    return result;
  }

  async setConfig(actor: Actor, input: SetWhiteLabelInput): Promise<WhiteLabelConfig> {
    if (!roleHasPermission(actor.role, PERMISSIONS.WHITE_LABEL_MANAGE)) {
      throw new ForbiddenException('Papel sem permissão para gerenciar identidade visual');
    }
    const scopeId = await resolveWritableScopeId(actor, input.scope, input.scopeId, this.prisma);

    return this.prisma.whiteLabelConfig.upsert({
      where: { scope_scopeId: { scope: input.scope, scopeId } },
      create: {
        scope: input.scope,
        scopeId,
        brandName: input.brandName,
        tagline: input.tagline,
        logoUrl: input.logoUrl,
        faviconUrl: input.faviconUrl,
        primaryColor: input.primaryColor,
        secondaryColor: input.secondaryColor,
        visualConfig: input.visualConfig ?? undefined,
      },
      update: {
        brandName: input.brandName,
        tagline: input.tagline,
        logoUrl: input.logoUrl,
        faviconUrl: input.faviconUrl,
        primaryColor: input.primaryColor,
        secondaryColor: input.secondaryColor,
        visualConfig: input.visualConfig ?? undefined,
      },
    });
  }
}
