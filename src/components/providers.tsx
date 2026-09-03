"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
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
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
