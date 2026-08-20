import { Building2, KeyRound, LayoutDashboard, Layers, Radio, Siren, Users2, Video } from "lucide-react";
import { PERMISSIONS, ROLE_DEPTH, roleHasPermission } from "@/lib/auth/permissions";
import type { AccessTokenClaims } from "@/lib/auth/jwt";

export interface NavItem {
  href: string;
  label: string;
  isVisible: (claims: AccessTokenClaims) => boolean;
}

export interface NavGroup {
  id: string;
  label: string;
  icon: typeof Building2;
  items: NavItem[];
  /** When set, the group renders as a single direct link (no expand/collapse trigger) instead of an expandable section — used for a lone top-level destination like "Dashboard". */
  href?: string;
  isVisible?: (claims: AccessTokenClaims) => boolean;
}

/**
 * Grouped navigation (sidebar sections that expand/collapse), matching the
 * reference layout's shape: "Gestão Condominial", "Portaria e Acessos",
 * "Segurança", "Administração", "Plataforma SaaS". Only real, working
 * destinations belong here — a nav entry pointing at an unbuilt page is
 * exactly the "fake button" the V01 frontend gate forbids. Add an item here
 * in the same change that ships its page.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    href: "/inicio",
    items: [],
  },
  {
    id: "condominial",
    label: "Gestão Condominial",
    icon: Building2,
    items: [
      {
        href: "/condominio",
        label: "Condomínio",
        // Papéis operacionais também veem (precisam consultar moradores/unidades);
        // só quem tem CONDOMINIUM_MANAGE consegue criar, e isso é gated na página.
        isVisible: (claims) =>
          !!claims.condominiumId &&
          [PERMISSIONS.CONDOMINIUM_MANAGE, PERMISSIONS.GATEHOUSE_OPERATE, PERMISSIONS.SECURITY_OPERATE].some(
            (permission) => roleHasPermission(claims.role, permission),
          ),
      },
    ],
  },
  {
    id: "portaria",
    label: "Portaria e Acessos",
    icon: KeyRound,
    items: [
      {
        href: "/portaria",
        label: "Portaria",
        // Requires a fixed condominiumId, not just the permission: GATEHOUSE_OPERATE
        // is also held by SUPER_ADMIN (full permission set), but this page always
        // operates on the actor's own condominium with no picker — meaningless
        // without one.
        isVisible: (claims) => roleHasPermission(claims.role, PERMISSIONS.GATEHOUSE_OPERATE) && !!claims.condominiumId,
      },
    ],
  },
  {
    id: "seguranca",
    label: "Segurança",
    icon: Siren,
    items: [
      {
        href: "/seguranca",
        label: "Ocorrências e Pânico",
        isVisible: (claims) => roleHasPermission(claims.role, PERMISSIONS.SECURITY_OPERATE) && !!claims.condominiumId,
      },
    ],
  },
  {
    id: "operacoes",
    label: "Operações",
    icon: Radio,
    items: [
      {
        href: "/operacoes",
        label: "Central de Operações",
        isVisible: (claims) => roleHasPermission(claims.role, PERMISSIONS.REPORTS_VIEW) && !!claims.condominiumId,
      },
    ],
  },
  {
    id: "monitoramento",
    label: "VMS",
    icon: Video,
    items: [
      {
        href: "/monitoramento/cameras",
        label: "Câmeras",
        isVisible: (claims) => roleHasPermission(claims.role, PERMISSIONS.REPORTS_VIEW) && !!claims.condominiumId,
      },
      {
        href: "/monitoramento/mosaicos",
        label: "Mosaicos",
        isVisible: (claims) => roleHasPermission(claims.role, PERMISSIONS.REPORTS_VIEW) && !!claims.condominiumId,
      },
      {
        href: "/monitoramento/visualizacoes",
        label: "Visualizações",
        isVisible: (claims) => roleHasPermission(claims.role, PERMISSIONS.REPORTS_VIEW) && !!claims.condominiumId,
      },
    ],
  },
  {
    id: "administracao",
    label: "Administração",
    icon: Users2,
    items: [
      {
        href: "/users",
        label: "Usuários",
        isVisible: (claims) => roleHasPermission(claims.role, PERMISSIONS.USER_MANAGE),
      },
      {
        href: "/personalizacao",
        label: "Personalização",
        isVisible: (claims) => roleHasPermission(claims.role, PERMISSIONS.WHITE_LABEL_MANAGE),
      },
    ],
  },
  {
    id: "plataforma",
    label: "Plataforma SaaS",
    icon: Layers,
    items: [
      {
        href: "/platform/tenancy",
        label: "Estrutura",
        isVisible: (claims) => ROLE_DEPTH[claims.role] < 3,
      },
    ],
  },
];

/** Flat view of every nav item, in group order — used where a single list is simpler than groups (landing route, breadcrumb title). */
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

/** Where a freshly-authenticated actor lands, based on the first nav item their role can see. */
export function resolveLandingRoute(claims: AccessTokenClaims): string {
  const first = NAV_ITEMS.find((item) => item.isVisible(claims));
  return first?.href ?? "/inicio";
}
