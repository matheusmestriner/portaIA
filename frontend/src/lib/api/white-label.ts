import { apiFetch } from "./client";

export type ThemeFont = "Inter" | "Manrope" | "Plus Jakarta Sans" | "Roboto" | "system-ui";

export interface VisualConfig {
  sidebarColor?: string;
  topbarColor?: string;
  pageColor?: string;
  cardColor?: string;
  borderColor?: string;
  textColor?: string;
  mutedTextColor?: string;
  successColor?: string;
  warningColor?: string;
  dangerColor?: string;
  headingFont?: ThemeFont;
  bodyFont?: ThemeFont;
  baseFontSize?: number;
  borderRadius?: number;
  headingWeight?: 500 | 600 | 700 | 800;
  defaultTheme?: "light" | "dark";
}

export interface EffectiveWhiteLabel {
  brandName: string | null;
  tagline: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  visualConfig: VisualConfig;
}

export type WhiteLabelScope = "GLOBAL" | "RESALE" | "CLIENT" | "CONDOMINIUM";

export interface WhiteLabelConfigResponse {
  id: string;
  scope: WhiteLabelScope;
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

export function getEffectiveWhiteLabel(): Promise<EffectiveWhiteLabel> {
  return apiFetch("/platform/white-label");
}

export interface SetWhiteLabelInput {
  scope: WhiteLabelScope;
  scopeId?: string;
  brandName?: string;
  tagline?: string;
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  visualConfig?: VisualConfig;
}

export function setWhiteLabel(
  input: SetWhiteLabelInput,
  idempotencyKey: string,
): Promise<WhiteLabelConfigResponse> {
  return apiFetch("/platform/white-label", {
    method: "PUT",
    headers: { "Idempotency-Key": idempotencyKey },
    body: input,
  });
}
