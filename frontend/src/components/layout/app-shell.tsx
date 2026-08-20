"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, LogOut, Menu, Moon, Sun, X } from "lucide-react";
import { useTheme } from "next-themes";
import { NAV_GROUPS, NAV_ITEMS } from "./nav-config";
import { useSessionStore } from "@/lib/auth/session-store";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { useBranding, DEFAULT_BRAND_NAME } from "@/components/branding-provider";

/** Nome/logo do tenant, com fallback para a marca do produto. */
function BrandMark() {
  const branding = useBranding();
  const name = branding?.brandName ?? DEFAULT_BRAND_NAME;

  return (
    <div className="app-sidebar__brand-card">
      {branding?.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={branding.logoUrl} alt={name} className="h-7 max-w-[200px] object-contain" />
      ) : (
        <span className="font-semibold text-lg tracking-tight">{name}</span>
      )}
      {branding?.tagline && <small>{branding.tagline}</small>}
    </div>
  );
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/);
  const initials = parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : parts[0]?.slice(0, 2);
  return (initials || "?").toUpperCase();
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { resolvedTheme, setTheme } = useTheme();
  const claims = useSessionStore((s) => s.claims);
  const logout = useSessionStore((s) => s.logout);
  const role = claims?.role;
  const roleLabel = role ? ROLE_LABELS[role] : "";

  const visibleGroups = useMemo(() => {
    if (!claims) return [];
    return NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => item.isVisible(claims)),
    })).filter((group) => (group.href ? (group.isVisible?.(claims) ?? true) : group.items.length > 0));
  }, [claims]);

  const activeGroupId =
    visibleGroups.find((group) => (group.href ? pathname.startsWith(group.href) : group.items.some((item) => pathname.startsWith(item.href))))
      ?.id ?? null;
  const [expandedGroup, setExpandedGroup] = useState<string | null>(() => activeGroupId);
  // Adjust state during render (React's documented pattern for "reset state
  // when a prop changes"), not an effect: auto-expand the group the route
  // just navigated into, while still letting the user manually expand a
  // different group afterwards without it snapping back.
  const [trackedGroupId, setTrackedGroupId] = useState(activeGroupId);
  if (activeGroupId !== trackedGroupId) {
    setTrackedGroupId(activeGroupId);
    if (activeGroupId) setExpandedGroup(activeGroupId);
  }

  const activeItem = claims ? NAV_ITEMS.filter((item) => item.isVisible(claims)).find((item) => pathname.startsWith(item.href)) : undefined;

  async function handleLogout() {
    // Clear before the request resolves, not after: any query that refetches
    // in the gap would do so with this actor's still-valid access token and
    // hand its data to whoever ends up authenticated next in this tab.
    queryClient.clear();
    await logout();
  }

  function toggleTheme() {
    localStorage.setItem("portalia_theme_chosen", "true");
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }

  function toggleGroup(groupId: string) {
    setExpandedGroup((current) => (current === groupId ? null : groupId));
  }

  return (
    <div className="app-shell">
      <aside className={`app-sidebar ${open ? "app-sidebar--open" : ""}`}>
        <div className="relative flex-none">
          <BrandMark />
          <button
            type="button"
            className="app-icon-button app-sidebar__close absolute"
            onClick={() => setOpen(false)}
            aria-label="Fechar menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav aria-label="Navegação principal">
          <div className="nav-groups">
            {visibleGroups.map((group) => {
              const GroupIcon = group.icon;
              const isActive = group.id === activeGroupId;

              if (group.href) {
                return (
                  <section className={`nav-group ${isActive ? "nav-group--active" : ""}`} key={group.id}>
                    <Link href={group.href} className="nav-group__trigger nav-group__trigger--link" onClick={() => setOpen(false)}>
                      <GroupIcon className="nav-group__icon" size={17} aria-hidden="true" />
                      <span>{group.label}</span>
                    </Link>
                  </section>
                );
              }

              const isExpanded = expandedGroup === group.id;
              const childrenId = `nav-group-${group.id}`;

              return (
                <section className={`nav-group ${isActive ? "nav-group--active" : ""}`} key={group.id}>
                  <button
                    type="button"
                    className="nav-group__trigger"
                    onClick={() => toggleGroup(group.id)}
                    aria-expanded={isExpanded}
                    aria-controls={childrenId}
                  >
                    <GroupIcon className="nav-group__icon" size={17} aria-hidden="true" />
                    <span>{group.label}</span>
                    <ChevronDown className="nav-group__chevron" size={16} aria-hidden="true" />
                  </button>

                  <div id={childrenId} className={`nav-group__children ${isExpanded ? "nav-group__children--open" : ""}`} aria-hidden={!isExpanded}>
                    <div>
                      {group.items.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={pathname.startsWith(item.href) ? "active" : ""}
                          onClick={() => setOpen(false)}
                          title={item.label}
                          tabIndex={isExpanded ? 0 : -1}
                        >
                          <span className="nav-dot" aria-hidden="true" />
                          <span className="nav-label">{item.label}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        </nav>

        <div className="app-sidebar__footer">
          {roleLabel && <small>{roleLabel}</small>}
        </div>
      </aside>

      {open && (
        <button
          type="button"
          className="app-sidebar-overlay"
          onClick={() => setOpen(false)}
          aria-label="Fechar menu"
        />
      )}

      <div className="app-main">
        <header className="app-topbar">
          <button
            type="button"
            className="app-icon-button app-mobile-menu-trigger"
            onClick={() => setOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu size={20} />
          </button>

          <div className="app-topbar__copy">
            <span className="app-topbar__eyebrow">Portalia</span>
            <h1>{activeItem?.label ?? "Início"}</h1>
          </div>

          <div className="app-premium-toolbar">
            <button
              type="button"
              className="app-icon-button"
              onClick={toggleTheme}
              aria-label={resolvedTheme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
            >
              {resolvedTheme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <div className="app-user-menu">
              <span className="app-user-menu__avatar">{initialsFor(roleLabel || "Portalia")}</span>
              <span className="app-user-menu__meta">
                <strong>{roleLabel || "Usuário"}</strong>
                <small>Sessão ativa</small>
              </span>
              <ChevronDown size={14} className="text-muted-foreground" />
            </div>

            <button type="button" className="app-logout-button" onClick={() => handleLogout()}>
              <LogOut size={16} />
              <span>Sair</span>
            </button>
          </div>
        </header>

        <main className="app-page-content">{children}</main>
      </div>
    </div>
  );
}
