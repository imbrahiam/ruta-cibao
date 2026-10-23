"use client";

import { CheckCircle2 } from "lucide-react";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Announce = (message: string) => void;

const OutcomeContext = createContext<Announce | null>(null);

/**
 * A visible, announced confirmation. A decision that quietly disappears from a
 * list leaves a reviewer unsure it went through, so every successful action
 * says so in text, in a polite live region, for a few seconds.
 */
export function OutcomeProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const announce = useCallback<Announce>((next) => {
    clearTimeout(timer.current);
    setMessage(next);
    timer.current = setTimeout(() => setMessage(null), 6000);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  const value = useMemo(() => announce, [announce]);

  return (
    <OutcomeContext.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[max(16px,env(safe-area-inset-bottom))]"
      >
        {message ? (
          <p className="animate-rise pointer-events-auto flex max-w-md items-center gap-2.5 rounded-full bg-ink px-4 py-3 text-[15px] font-medium text-paper shadow-lg">
            <CheckCircle2 aria-hidden className="size-5 shrink-0" />
            {message}
          </p>
        ) : null}
      </div>
    </OutcomeContext.Provider>
  );
}

export function useOutcome(): Announce {
  const announce = useContext(OutcomeContext);
  if (!announce) throw new Error("useOutcome needs <OutcomeProvider>");
  return announce;
}
