"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { type ReactNode, useState } from "react";
import { AuthProvider } from "@/components/auth/auth-context";
import { ToastProvider } from "@/components/ui/toast";
import { makeQueryClient } from "@/lib/query";

/**
 * One query client per browser session, created in state so the server never
 * shares one visitor's cache with another's render.
 *
 * Light unless the person picks dark (or "system") themselves; `data-theme` on
 * `<html>` is what the tokens and the map style both key off.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(makeQueryClient);

  return (
    <ThemeProvider
      attribute="data-theme"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <NuqsAdapter>
            <ToastProvider>{children}</ToastProvider>
          </NuqsAdapter>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
