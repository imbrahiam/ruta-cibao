"use client";

import { CheckCircle2, CircleAlert } from "lucide-react";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

type Tone = "success" | "error";
type Announce = (message: string, tone?: Tone) => void;

const OutcomeContext = createContext<Announce | null>(null);

/** How long each kind stays: a failure is read, a confirmation only glanced at. */
const VISIBLE_MS: Record<Tone, number> = { success: 3000, error: 7000 };

/**
 * A short, announced confirmation. Decisions leave their list at once, so a
 * reviewer needs a word that the server took them: it says so in text, in a
 * live region, for a few seconds. A failure the card cannot show itself (a
 * conflict) uses the same place, as an alert.
 */
export function OutcomeProvider({ children }: { children: ReactNode }) {
  const [outcome, setOutcome] = useState<{
    message: string;
    tone: Tone;
    id: number;
  } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const count = useRef(0);

  const announce = useCallback<Announce>((message, tone = "success") => {
    clearTimeout(timer.current);
    count.current += 1;
    setOutcome({ message, tone, id: count.current });
    timer.current = setTimeout(() => setOutcome(null), VISIBLE_MS[tone]);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  const Icon = outcome?.tone === "error" ? CircleAlert : CheckCircle2;

  return (
    <OutcomeContext.Provider value={announce}>
      {children}
      <div
        role={outcome?.tone === "error" ? "alert" : "status"}
        aria-live={outcome?.tone === "error" ? "assertive" : "polite"}
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[max(16px,env(safe-area-inset-bottom))]"
      >
        {outcome ? (
          <p
            key={outcome.id}
            className={cn(
              "animate-rise pointer-events-auto flex max-w-md items-center gap-2.5 rounded-full px-4 py-2.5 text-sm font-medium shadow-(--shadow-elevated)",
              outcome.tone === "error"
                ? "bg-destructive text-destructive-foreground"
                : "bg-foreground text-background",
            )}
          >
            <Icon aria-hidden className="size-4 shrink-0" />
            {outcome.message}
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
