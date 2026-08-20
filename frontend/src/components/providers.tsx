"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/components/theme-provider";
import { BrandingProvider } from "@/components/branding-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { ApiError } from "@/lib/api/types";

function isRetryableError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return true;
  return error.status >= 500;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: (failureCount, error) => failureCount < 2 && isRetryableError(error),
          },
        },
      }),
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <BrandingProvider>
          <TooltipProvider>
            {children}
            <Toaster />
          </TooltipProvider>
        </BrandingProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
