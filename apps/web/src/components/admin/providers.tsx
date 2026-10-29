"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { createContext, type ReactNode, useContext, useState } from "react";
import { IntlProvider } from "use-intl/react";
import { formats, TIME_ZONE } from "@/i18n/config";
import { LOCALE } from "@/lib/web/i18n";
import { makeQueryClient } from "@/lib/web/query";
import { OutcomeProvider } from "./outcome";

const ResetSessionContext = createContext<(() => void) | null>(null);

export function useResetAdminSession() {
  const reset = useContext(ResetSessionContext);
  if (!reset) throw new Error("useResetAdminSession needs <AdminProviders>");
  return reset;
}

export function AdminProviders({
  messages,
  children,
}: {
  messages: Record<string, unknown>;
  children: ReactNode;
}) {
  const [session, setSession] = useState(() => ({
    client: makeQueryClient(),
    generation: 0,
  }));

  const resetSession = () => {
    // Remount observers as well as clearing data; late mutations keep the discarded client.
    session.client.clear();
    setSession({
      client: makeQueryClient(),
      generation: session.generation + 1,
    });
  };

  return (
    <IntlProvider
      locale={LOCALE}
      messages={messages as never}
      timeZone={TIME_ZONE}
      formats={formats}
    >
      <ResetSessionContext.Provider value={resetSession}>
        <QueryClientProvider key={session.generation} client={session.client}>
          <OutcomeProvider>{children}</OutcomeProvider>
        </QueryClientProvider>
      </ResetSessionContext.Provider>
    </IntlProvider>
  );
}
