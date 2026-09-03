import { CheckCircle2, Clock, Loader2 } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getServerViewer } from "@/modules/access/server";

/**
 * Shown while the viewer is being resolved.
 *
 * A short sentence with a spinner, not a grey box pretending to be content:
 * a skeleton the size of a banner that usually is not there would make the page
 * jump for everyone who has nothing to show.
 */
export async function VerificationStatusFallback() {
  const t = await getTranslations("onboarding.cedula");

  return (
    <p
      className="flex items-center gap-2 text-muted-foreground text-xs"
      role="status"
      aria-live="polite"
    >
      <Loader2
        className="size-3.5 animate-spin motion-reduce:animate-none"
        aria-hidden
      />
      {t("loadingStatus")}
    </p>
  );
}

/** Nothing for a visitor who has not started; a note for anyone mid-flight. */
export async function VerificationStatus() {
  const viewer = await getServerViewer();
  if (viewer.kind === "anonymous") return null;

  const t = await getTranslations("onboarding.cedula");

  if (viewer.kind === "citizen") {
    return (
      <p className="flex items-start gap-2 rounded-lg bg-emerald-500/10 p-3 text-emerald-700 text-sm dark:text-emerald-400">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
        {t("verified", { name: viewer.profile.verifiedFullName })}
      </p>
    );
  }

  if (viewer.profile.cedulaStatus === "pending") {
    return (
      <p className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-3 text-amber-700 text-sm dark:text-amber-400">
        <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
        {t("pending")}
      </p>
    );
  }

  return null;
}
