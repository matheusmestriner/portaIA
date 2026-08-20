"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff } from "lucide-react";
import { useSessionStore } from "@/lib/auth/session-store";
import { resolveLandingRoute } from "@/components/layout/nav-config";
import { AuthCardShell } from "@/components/auth/auth-card-shell";
import { ApiError } from "@/lib/api/types";

const loginSchema = z.object({
  email: z.string().max(180, "O e-mail excede o limite permitido").email("Informe um e-mail válido"),
  password: z.string().min(1, "Informe a senha").max(200, "A senha excede o limite permitido"),
});

/**
 * `next` is attacker-controlled query-string input (whoever crafts the login
 * link). Only accept an internal relative path — `//host/...` and
 * `/\host/...` are protocol-relative/backslash variants browsers also treat
 * as a host change, so both must be rejected alongside bare absolute URLs.
 */
function safeNextPath(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return null;
  return raw;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const login = useSessionStore((s) => s.login);
  const status = useSessionStore((s) => s.status);
  const claims = useSessionStore((s) => s.claims);
  const [error, setError] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (status === "authenticated" && claims) {
      router.replace(safeNextPath(searchParams.get("next")) ?? resolveLandingRoute(claims));
    }
  }, [status, claims, router, searchParams]);

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: z.infer<typeof loginSchema>) {
    setError(null);
    try {
      // Clear first: a stale cache entry from whoever used this tab before
      // (branding, user lists) must never render under the new identity,
      // not even for the instant before its query refetches.
      queryClient.clear();
      const { mustChangePassword } = await login(values.email, values.password);
      if (mustChangePassword) {
        router.push("/change-password");
        return;
      }
      const freshClaims = useSessionStore.getState().claims;
      router.push(safeNextPath(searchParams.get("next")) ?? (freshClaims ? resolveLandingRoute(freshClaims) : "/"));
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 429)) {
        setError(err.status === 429 ? "Muitas tentativas. Aguarde um minuto e tente novamente." : "Email ou senha inválidos.");
      } else {
        setError("Não foi possível entrar. Tente novamente.");
      }
    }
  }

  return (
    <AuthCardShell title="Entrar no Portalia" description="Use as credenciais fornecidas pela sua administração.">
        <form onSubmit={form.handleSubmit(onSubmit)}>
          {error && (
            <div className="login-form-error" role="alert">
              {error}
            </div>
          )}

          <label className="login-field">
            <span>Email</span>
            <input
              type="email"
              autoComplete="username"
              placeholder="voce@empresa.com.br"
              aria-invalid={!!form.formState.errors.email}
              {...form.register("email")}
            />
            {form.formState.errors.email && <small>{form.formState.errors.email.message}</small>}
          </label>

          <label className="login-field">
            <span>Senha</span>
            <div className="login-password-field">
              <input
                type={visible ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Digite sua senha"
                aria-invalid={!!form.formState.errors.password}
                {...form.register("password")}
              />
              <button
                type="button"
                onClick={() => setVisible((value) => !value)}
                aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
              >
                {visible ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {form.formState.errors.password && <small>{form.formState.errors.password.message}</small>}
          </label>

          <button type="submit" className="login-submit-button" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Entrando..." : "Entrar na plataforma"}
          </button>
        </form>
    </AuthCardShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
