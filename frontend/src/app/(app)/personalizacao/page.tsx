"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSessionStore } from "@/lib/auth/session-store";
import { ROLE_DEPTH } from "@/lib/auth/permissions";
import {
  getEffectiveWhiteLabel,
  setWhiteLabel,
  type EffectiveWhiteLabel,
  type ThemeFont,
  type VisualConfig,
  type WhiteLabelScope,
} from "@/lib/api/white-label";
import { ApiError } from "@/lib/api/types";

const FONTS: ThemeFont[] = ["Inter", "Manrope", "Plus Jakarta Sans", "Roboto", "system-ui"];

/** Escopo em que o ator escreve: sempre o seu próprio nível na hierarquia. */
function scopeForDepth(depth: number): WhiteLabelScope {
  if (depth === 0) return "GLOBAL";
  if (depth === 1) return "RESALE";
  if (depth === 2) return "CLIENT";
  return "CONDOMINIUM";
}

const SCOPE_LABELS: Record<WhiteLabelScope, string> = {
  GLOBAL: "toda a plataforma",
  RESALE: "sua revenda e tudo abaixo dela",
  CLIENT: "seu cliente e seus condomínios",
  CONDOMINIUM: "seu condomínio",
};

function ColorField({
  label,
  value,
  onChange,
  description,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  description?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value || "#0b5bd3"}
          onChange={(event) => onChange(event.target.value)}
          className="size-9 cursor-pointer rounded border bg-transparent"
          aria-label={label}
        />
        <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder="#0B5BD3" />
      </div>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </div>
  );
}

export default function PersonalizacaoPage() {
  const brandingQuery = useQuery({
    queryKey: ["white-label", "effective"],
    queryFn: getEffectiveWhiteLabel,
  });

  if (brandingQuery.isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }
  if (!brandingQuery.data) return null;

  // key remonta o formulário quando o branding efetivo muda, semeando os
  // campos pelos inicializadores do useState — sem espelhar via efeito.
  return <PersonalizacaoForm key={brandingQuery.dataUpdatedAt} initial={brandingQuery.data} />;
}

function PersonalizacaoForm({ initial }: { initial: EffectiveWhiteLabel }) {
  const claims = useSessionStore((s) => s.claims);
  const queryClient = useQueryClient();

  const [brandName, setBrandName] = useState(initial.brandName ?? "");
  const [tagline, setTagline] = useState(initial.tagline ?? "");
  const [logoUrl, setLogoUrl] = useState(initial.logoUrl ?? "");
  const [faviconUrl, setFaviconUrl] = useState(initial.faviconUrl ?? "");
  const [primaryColor, setPrimaryColor] = useState(initial.primaryColor ?? "");
  const [secondaryColor, setSecondaryColor] = useState(initial.secondaryColor ?? "");
  const [visual, setVisual] = useState<VisualConfig>(initial.visualConfig ?? {});
  const [saving, setSaving] = useState(false);

  if (!claims) return null;
  const scope = scopeForDepth(ROLE_DEPTH[claims.role]);

  function patchVisual(patch: Partial<VisualConfig>) {
    setVisual((current) => ({ ...current, ...patch }));
  }

  async function save() {
    setSaving(true);
    try {
      await setWhiteLabel(
        {
          scope,
          brandName: brandName || undefined,
          tagline: tagline || undefined,
          logoUrl: logoUrl || undefined,
          faviconUrl: faviconUrl || undefined,
          primaryColor: primaryColor || undefined,
          secondaryColor: secondaryColor || undefined,
          visualConfig: visual,
        },
        crypto.randomUUID(),
      );
      toast.success("Identidade visual salva. As mudanças já estão aplicadas.");
      // Refaz o branding efetivo para o tema recarregar em toda a aplicação.
      await queryClient.invalidateQueries({ queryKey: ["white-label", "effective"] });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível salvar a identidade visual.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Personalização</h1>
        <p className="text-sm text-muted-foreground">
          As alterações valem para {SCOPE_LABELS[scope]}. Níveis mais específicos podem sobrescrever campo a campo.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Marca</CardTitle>
            <CardDescription>Nome, assinatura e imagens exibidas no painel.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="brandName">Nome da marca</Label>
              <Input id="brandName" value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="Portalia" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tagline">Assinatura</Label>
              <Input id="tagline" value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Portaria remota" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="logoUrl">URL do logo</Label>
              <Input id="logoUrl" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="faviconUrl">URL do favicon</Label>
              <Input id="faviconUrl" value={faviconUrl} onChange={(e) => setFaviconUrl(e.target.value)} placeholder="https://..." />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cores principais</CardTitle>
            <CardDescription>Aplicadas a botões, links e destaques.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ColorField label="Cor primária" value={primaryColor} onChange={setPrimaryColor} />
            <ColorField label="Cor secundária" value={secondaryColor} onChange={setSecondaryColor} />
            <ColorField
              label="Fundo da página"
              value={visual.pageColor ?? ""}
              onChange={(value) => patchVisual({ pageColor: value })}
            />
            <ColorField
              label="Fundo dos cards"
              value={visual.cardColor ?? ""}
              onChange={(value) => patchVisual({ cardColor: value })}
            />
            <ColorField
              label="Barra lateral"
              value={visual.sidebarColor ?? ""}
              onChange={(value) => patchVisual({ sidebarColor: value })}
            />
            <ColorField
              label="Bordas"
              value={visual.borderColor ?? ""}
              onChange={(value) => patchVisual({ borderColor: value })}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cores de status</CardTitle>
            <CardDescription>Usadas em badges e alertas.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ColorField
              label="Sucesso"
              value={visual.successColor ?? ""}
              onChange={(value) => patchVisual({ successColor: value })}
            />
            <ColorField
              label="Atenção"
              value={visual.warningColor ?? ""}
              onChange={(value) => patchVisual({ warningColor: value })}
            />
            <ColorField
              label="Erro"
              value={visual.dangerColor ?? ""}
              onChange={(value) => patchVisual({ dangerColor: value })}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tipografia e forma</CardTitle>
            <CardDescription>Fonte, tamanho base e arredondamento.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Fonte dos títulos</Label>
              <Select
                value={visual.headingFont ?? "Inter"}
                onValueChange={(value) => patchVisual({ headingFont: value as ThemeFont })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FONTS.map((font) => (
                    <SelectItem key={font} value={font}>
                      {font}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Fonte do corpo</Label>
              <Select
                value={visual.bodyFont ?? "Inter"}
                onValueChange={(value) => patchVisual({ bodyFont: value as ThemeFont })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FONTS.map((font) => (
                    <SelectItem key={font} value={font}>
                      {font}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="baseFontSize">Tamanho base (px)</Label>
                <Input
                  id="baseFontSize"
                  type="number"
                  min={12}
                  max={18}
                  value={visual.baseFontSize ?? 14}
                  onChange={(e) => patchVisual({ baseFontSize: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="borderRadius">Arredondamento (px)</Label>
                <Input
                  id="borderRadius"
                  type="number"
                  min={0}
                  max={28}
                  value={visual.borderRadius ?? 14}
                  onChange={(e) => patchVisual({ borderRadius: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Tema padrão</Label>
              <Select
                value={visual.defaultTheme ?? "light"}
                onValueChange={(value) => patchVisual({ defaultTheme: value as "light" | "dark" })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Claro</SelectItem>
                  <SelectItem value="dark">Escuro</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Vale só até o usuário escolher o tema dele manualmente.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          <Palette className="size-4" />
          {saving ? "Salvando..." : "Salvar identidade visual"}
        </Button>
      </div>
    </div>
  );
}
