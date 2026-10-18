"use client";

import { Check, Download, Share } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

type PromptEvent = Event & {
  prompt(): Promise<unknown>;
  userChoice: Promise<{ outcome: string }>;
};

/**
 * Installing the web app. Chrome and Edge offer their own dialog, which the
 * button triggers; Safari has none, so iPhones get the Share-sheet steps.
 */
export function InstallCard() {
  const t = useTranslations("install");
  const [event, setEvent] = useState<PromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    setInstalled(window.matchMedia("(display-mode: standalone)").matches);
    setIos(/iPhone|iPad|iPod/i.test(navigator.userAgent));
    const ready = (next: Event) => {
      next.preventDefault();
      setEvent(next as PromptEvent);
    };
    const done = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", ready);
    window.addEventListener("appinstalled", done);
    return () => {
      window.removeEventListener("beforeinstallprompt", ready);
      window.removeEventListener("appinstalled", done);
    };
  }, []);

  if (installed) {
    return (
      <div className="flex items-center gap-4 rounded-panel bg-accent-soft p-6">
        <Check strokeWidth={1.75} className="size-6 text-accent" />
        <div>
          <p className="text-[17px] font-medium">{t("installed")}</p>
          <p className="t-small text-ink-2">{t("installedHint")}</p>
        </div>
      </div>
    );
  }

  const steps = ios
    ? [t("iosStep1"), t("iosStep2"), t("iosStep3")]
    : [t("otherStep1"), t("otherStep2"), t("otherStep3")];

  return (
    <div className="flex flex-col gap-6 rounded-panel bg-card p-6 shadow-ring md:p-8">
      {event ? (
        <Button
          variant="accent"
          size="lg"
          className="self-start"
          onClick={async () => {
            try {
              await event.prompt();
              const choice = await event.userChoice;
              if (choice.outcome === "accepted") setInstalled(true);
            } catch {
              toast.error({ title: t("error") });
            }
          }}
        >
          <Download strokeWidth={1.75} />
          {t("action")}
        </Button>
      ) : null}
      <div>
        <p className="t-label text-ink-3">
          {ios ? t("iosTitle") : t("otherTitle")}
        </p>
        <ol className="mt-4 flex flex-col gap-4">
          {steps.map((step, index) => (
            <li key={step} className="flex items-start gap-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-paper-3 font-mono text-[12px] text-ink-2 tabular">
                {index + 1}
              </span>
              <span className="t-body pt-1 text-ink">
                {step}
                {ios && index === 1 ? (
                  <Share
                    strokeWidth={1.5}
                    className="ml-1.5 inline size-4 align-[-2px] text-ink-3"
                    aria-hidden
                  />
                ) : null}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
