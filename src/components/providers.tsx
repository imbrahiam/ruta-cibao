"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { useState } from "react";
import { AuthProvider } from "@/components/auth/auth-context";
import { InstallProvider } from "@/components/offline/install-provider";
import { makeQueryClient } from "@/lib/query";

/**
 * One query client per browser session.
 *
 * Created in state rather than at module scope: a module-level client would be
 * shared across requests on the server, leaking one visitor's cached data into
 * another's render.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(makeQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {/* Map state — which place is open, which categories are on — lives in
            the URL. That makes a view shareable by pasting a link, survivable
            across the reload a phone does when it drops signal, and closable
            with the back button rather than a control people have to find. */}
        <InstallProvider>
          <NuqsAdapter>{children}</NuqsAdapter>
        </InstallProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
