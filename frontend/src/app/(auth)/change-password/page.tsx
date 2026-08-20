"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useSessionStore } from "@/lib/auth/session-store";
import { resolveLandingRoute } from "@/components/layout/nav-config";
import { AuthCardShell } from "@/components/auth/auth-card-shell";
import { changePassword } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/types";

const schema = z
  .object({
    currentPassword: z.string().min(1, "Informe a senha atual"),
    newPassword: z.string().min(12, "A nova senha deve ter ao menos 12 caracteres"),
    confirmPassword: z.string().min(1, "Confirme a nova senha"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

export default function ChangePasswordPage() {
  const router = useRouter();
  const status = useSessionStore((s) => s.status);
  const accessToken = useSessionStore((s) => s.accessToken);
  const claims = useSessionStore((s) => s.claims);
  const mustChangePassword = useSessionStore((s) => s.mustChangePassword);
  const applyPasswordChange = useSessionStore((s) => s.applyPasswordChange);
  const init = useSessionStore((s) => s.init);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  async function onSubmit(values: z.infer<typeof schema>) {
    if (!accessToken) return;
    setError(null);
    try {
      const result = await changePassword(accessToken, values.currentPassword, values.newPassword);
      applyPasswordChange(result);
      router.replace(claims ? resolveLandingRoute(claims) : "/");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("Senha atual incorreta.");
      } else {
        setError("Não foi possível trocar a senha. Tente novamente.");
      }
    }
  }

  if (status !== "authenticated") return null;

  const description = mustChangePassword
    ? "Por segurança, defina uma nova senha antes de continuar."
    : "Defina uma nova senha para sua conta.";

  return (
    <AuthCardShell title="Troca de senha obrigatória" description={description}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          {error && (
            <div className="login-form-error" role="alert">
              {error}
            </div>
          )}

          <label className="login-field">
            <span>Senha atual</span>
            <input
              type="password"
              autoComplete="current-password"
              aria-invalid={!!form.formState.errors.currentPassword}
              {...form.register("currentPassword")}
            />
            {form.formState.errors.currentPassword && <small>{form.formState.errors.currentPassword.message}</small>}
          </label>

          <label className="login-field">
            <span>Nova senha</span>
            <input
              type="password"
              autoComplete="new-password"
              aria-invalid={!!form.formState.errors.newPassword}
              {...form.register("newPassword")}
            />
            {form.formState.errors.newPassword && <small>{form.formState.errors.newPassword.message}</small>}
          </label>

          <label className="login-field">
            <span>Confirmar nova senha</span>
            <input
              type="password"
              autoComplete="new-password"
              aria-invalid={!!form.formState.errors.confirmPassword}
              {...form.register("confirmPassword")}
            />
            {form.formState.errors.confirmPassword && <small>{form.formState.errors.confirmPassword.message}</small>}
          </label>

          <button type="submit" className="login-submit-button" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Salvando..." : "Salvar nova senha"}
          </button>
        </form>
    </AuthCardShell>
  );
}
