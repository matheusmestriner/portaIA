import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { DEFAULT_BRAND_NAME } from "@/components/branding-provider";

/** Glass-card shell shared by every full-screen auth page (login, troca de senha obrigatória). */
export function AuthCardShell({
  title,
  description,
  children,
}: {
  title: string;
  description: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="login-shell--portariaflow">
      <div className="login-orb login-orb--one" aria-hidden="true" />
      <div className="login-orb login-orb--two" aria-hidden="true" />

      <section className="login-card--standalone">
        <div className="login-logo-frame">
          <span className="text-2xl font-semibold tracking-tight">{DEFAULT_BRAND_NAME}</span>
        </div>

        <div className="login-heading">
          <span className="login-secure-label">
            <ShieldCheck size={15} /> Ambiente protegido
          </span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>

        {children}

        <footer>{DEFAULT_BRAND_NAME} · Gestão de portaria remota e híbrida</footer>
      </section>
    </main>
  );
}
