"use client";

import { Check, Link2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { buttonStyles } from "@/components/site/button";
import { cx } from "@/lib/web/cx";
import { useCopy } from "@/lib/web/use-copy";

type Outcome = "idle" | "copied" | "failed";

/**
 * Copies the shared link and confirms in place: the icon and label change,
 * and a status region says the same thing to screen readers. The button stays
 * enabled, so a failed copy can be retried at once.
 */
export function CopyLink({
  value,
  labels,
}: {
  value: string;
  labels: { copy: string; copied: string; failed: string };
}) {
  const copy = useCopy();
  const [outcome, setOutcome] = useState<Outcome>("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const onClick = async () => {
    clearTimeout(timer.current);
    setOutcome((await copy(value)) ? "copied" : "failed");
    timer.current = setTimeout(() => setOutcome("idle"), 2000);
  };

  const message =
    outcome === "copied"
      ? labels.copied
      : outcome === "failed"
        ? labels.failed
        : "";

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        className={cx(buttonStyles({ variant: "ghost" }), "-ml-3 self-start")}
      >
        {outcome === "copied" ? <Check aria-hidden /> : <Link2 aria-hidden />}
        <span aria-hidden={outcome !== "idle"}>{message || labels.copy}</span>
        {outcome !== "idle" ? (
          <span className="sr-only">{labels.copy}</span>
        ) : null}
      </button>
      <span role="status" className="sr-only">
        {message}
      </span>
    </>
  );
}
