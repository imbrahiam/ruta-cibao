"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { IntlProvider } from "use-intl/react";
import { formats, TIME_ZONE } from "@/i18n/config";
import { LOCALE } from "@/lib/web/i18n";
import { makeQueryClient } from "@/lib/web/query";
import { OutcomeProvider } from "./outcome";

/**
 * Everything a staff screen needs from above: the catalogue slice, one query
 * client per browser session, and the confirmation region decisions announce
 * their result into.
 */
export function AdminProviders({
  messages,
  children,
}: {
  messages: Record<string, unknown>;
  children: ReactNode;
}) {
  const [queryClient] = useState(makeQueryClient);

  return (
    <IntlProvider
      locale={LOCALE}
      messages={messages as never}
      timeZone={TIME_ZONE}
      formats={formats}
    >
      <QueryClientProvider client={queryClient}>
        <OutcomeProvider>{children}</OutcomeProvider>
      </QueryClientProvider>
    </IntlProvider>
  );
}
