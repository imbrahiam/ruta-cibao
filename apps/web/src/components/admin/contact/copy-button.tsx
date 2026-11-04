"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useOutcome } from "../outcome";
import { useCopy } from "./use-copy";

const FEEDBACK_MS = 2000;

/**
 * An icon button that copies `value`. The icon turns into a check for two
 * seconds and a polite live region says "Copiado", so the confirmation is
 * neither colour-only nor sight-only. `what` completes the accessible name:
 * "Copiar {what}" ("las coordenadas", "el identificador").
 */
export function CopyButton({
  value,
  what,
  className,
}: {
  value: string;
  what: string;
  className?: string;
}) {
  const t = useTranslations("admin.contactActions");
  const announce = useOutcome();
  const copy = useCopy();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={t("copyLabel", { what })}
        title={t("copyLabel", { what })}
        className={cn(
          "text-muted-foreground hover:text-foreground pointer-coarse:size-11 pointer-coarse:[&_svg:not([class*='size-'])]:size-4",
          className,
        )}
        onClick={async () => {
          if (!(await copy(value))) {
            announce(t("copyFailed"), "error");
            return;
          }
          setCopied(true);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => setCopied(false), FEEDBACK_MS);
        }}
      >
        {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
      </Button>
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? t("copied") : ""}
      </span>
    </>
  );
}
