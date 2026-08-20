"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSessionStore } from "@/lib/auth/session-store";
import { resolveLandingRoute } from "@/components/layout/nav-config";
import { Skeleton } from "@/components/ui/skeleton";

export default function Home() {
  const router = useRouter();
  const status = useSessionStore((s) => s.status);
  const claims = useSessionStore((s) => s.claims);
  const mustChangePassword = useSessionStore((s) => s.mustChangePassword);
  const init = useSessionStore((s) => s.init);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    } else if (status === "authenticated") {
      if (mustChangePassword) {
        router.replace("/change-password");
      } else if (claims) {
        router.replace(resolveLandingRoute(claims));
      }
    }
  }, [status, mustChangePassword, claims, router]);

  return (
    <div className="flex h-screen w-full items-center justify-center">
      <div className="w-64 space-y-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-full" />
      </div>
    </div>
  );
}
