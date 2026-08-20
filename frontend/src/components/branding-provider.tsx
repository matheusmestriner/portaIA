"use client";

import { createContext, useContext, useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { getEffectiveWhiteLabel, type EffectiveWhiteLabel, type VisualConfig } from "@/lib/api/white-label";
import { useSessionStore } from "@/lib/auth/session-store";

const BrandingContext = createContext<EffectiveWhiteLabel | null>(null);

export const DEFAULT_BRAND_NAME = "Portalia";

const HEX = /^#[0-9a-fA-F]{6}$/;
const ALLOWED_FONTS = new Set(["Inter", "Manrope", "Plus Jakarta Sans", "Roboto", "system-ui"]);

/**
 * Tokens que o white-label pode sobrescrever. Guardamos a lista para poder
 * limpá-los ao desmontar/trocar de tenant — sem isso, trocar de conta deixaria
 * as cores da marca anterior grudadas no `style` do <html>.
 */
const OVERRIDABLE = [
  "--primary",
  "--ring",
  "--sidebar-primary",
  "--sidebar",
  "--sidebar-border",
  "--background",
  "--card",
  "--popover",
  "--border",
  "--input",
  "--foreground",
  "--card-foreground",
  "--popover-foreground",
  "--sidebar-foreground",
  "--muted-foreground",
  "--success",
  "--warning",
  "--destructive",
  "--radius",
  "--brand-font-heading",
  "--brand-font-body",
  "--brand-font-size",
  "--brand-heading-weight",
] as const;

function applyBranding(branding: EffectiveWhiteLabel): void {
  const root = document.documentElement;
  const visual: VisualConfig = branding.visualConfig ?? {};

  const setColor = (property: string, value: string | null | undefined) => {
    // Revalidado no cliente: estes valores entram num `style`, então um valor
    // inesperado vindo da API não pode virar CSS arbitrário.
    if (value && HEX.test(value)) root.style.setProperty(property, value);
  };

  setColor("--primary", branding.primaryColor);
  setColor("--ring", branding.primaryColor);
  setColor("--sidebar-primary", branding.primaryColor);
  setColor("--sidebar", visual.sidebarColor);
  setColor("--sidebar-border", visual.borderColor);
  setColor("--background", visual.pageColor);
  setColor("--card", visual.cardColor);
  setColor("--popover", visual.cardColor);
  setColor("--border", visual.borderColor);
  setColor("--input", visual.borderColor);
  setColor("--foreground", visual.textColor);
  setColor("--card-foreground", visual.textColor);
  setColor("--popover-foreground", visual.textColor);
  setColor("--sidebar-foreground", visual.textColor);
  setColor("--muted-foreground", visual.mutedTextColor);
  setColor("--success", visual.successColor);
  setColor("--warning", visual.warningColor);
  setColor("--destructive", visual.dangerColor);

  if (typeof visual.borderRadius === "number") {
    root.style.setProperty("--radius", `${Math.min(28, Math.max(0, visual.borderRadius))}px`);
  }
  if (visual.headingFont && ALLOWED_FONTS.has(visual.headingFont)) {
    root.style.setProperty("--brand-font-heading", visual.headingFont);
  }
  if (visual.bodyFont && ALLOWED_FONTS.has(visual.bodyFont)) {
    root.style.setProperty("--brand-font-body", visual.bodyFont);
  }
  if (typeof visual.baseFontSize === "number") {
    root.style.setProperty("--brand-font-size", `${Math.min(18, Math.max(12, visual.baseFontSize))}px`);
  }
  if ([500, 600, 700, 800].includes(Number(visual.headingWeight))) {
    root.style.setProperty("--brand-heading-weight", String(visual.headingWeight));
  }
}

function clearBranding(): void {
  const root = document.documentElement;
  OVERRIDABLE.forEach((property) => root.style.removeProperty(property));
}

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const status = useSessionStore((s) => s.status);
  const pathname = usePathname();
  const { setTheme } = useTheme();

  const brandingQuery = useQuery({
    queryKey: ["white-label", "effective"],
    queryFn: getEffectiveWhiteLabel,
    enabled: status === "authenticated",
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  const branding = brandingQuery.data ?? null;

  useEffect(() => {
    if (!branding) {
      clearBranding();
      return;
    }
    applyBranding(branding);
    return clearBranding;
  }, [branding]);

  // O metadata do Next reescreve o <title> a cada navegação, então o nome da
  // marca precisa ser reaplicado depois — daí a dependência no pathname.
  useEffect(() => {
    if (!branding?.brandName) return;
    document.title = branding.brandName;
  }, [branding?.brandName, pathname]);

  useEffect(() => {
    // O tema padrão do tenant só vale enquanto o usuário não escolheu o dele.
    const preferred = branding?.visualConfig?.defaultTheme;
    if (preferred && !localStorage.getItem("portalia_theme_chosen")) {
      setTheme(preferred);
    }
  }, [branding, setTheme]);

  useEffect(() => {
    const href = branding?.faviconUrl;
    if (!href) return;
    const link = document.querySelector<HTMLLinkElement>("link[rel='icon']") ?? document.createElement("link");
    link.rel = "icon";
    link.href = href;
    if (!link.parentNode) document.head.appendChild(link);
  }, [branding?.faviconUrl]);

  const value = useMemo(() => branding, [branding]);
  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding(): EffectiveWhiteLabel | null {
  return useContext(BrandingContext);
}

export function useBrandName(): string {
  return useBranding()?.brandName ?? DEFAULT_BRAND_NAME;
}
