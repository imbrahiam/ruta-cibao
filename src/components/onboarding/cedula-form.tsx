"use client";

import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, ShieldCheck, XCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { verifyCedulaAction } from "@/app/[locale]/(onboarding)/verificar/actions";
import {
  initialVerifyState,
  type VerifyState,
} from "@/app/[locale]/(onboarding)/verificar/verify-state";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { useRouter } from "@/i18n/navigation";
import { CedulaInput } from "./cedula-input";
import { CedulaPrivacyDrawer } from "./cedula-privacy-drawer";
import { MunicipalityPicker } from "./municipality-picker";

type Municipality = { id: string; name: string };

/**
 * Submit button.
 *
 * Its own component so `useFormStatus` can read the pending state of the form
 * above it. The button says what is happening — no skeleton, no layout shift,
 * just the control the person pressed telling them it heard them.
 */
function SubmitButton() {
  const t = useTranslations("onboarding.cedula");
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      size="lg"
      className="h-12 w-full text-base"
      disabled={pending}
    >
      {pending ? (
        <>
          <Spinner /> {t("checking")}
        </>
      ) : (
        t("submit")
      )}
    </Button>
  );
}

const OUTCOME_ICON: Record<
  Exclude<VerifyState["status"], "idle">,
  typeof CheckCircle2
> = {
  verified: CheckCircle2,
  pending: Clock,
  rejected: XCircle,
  taken: XCircle,
  invalid: XCircle,
};

const OUTCOME_TONE: Record<Exclude<VerifyState["status"], "idle">, string> = {
  verified: "text-emerald-600 dark:text-emerald-400",
  pending: "text-amber-600 dark:text-amber-400",
  rejected: "text-destructive",
  taken: "text-destructive",
  invalid: "text-destructive",
};

export function CedulaForm({
  municipalities,
  next,
}: {
  municipalities: Municipality[];
  /** Where a verified resident continues. Sanitized by the page. */
  next: string;
}) {
  const t = useTranslations("onboarding.cedula");
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [state, formAction] = useActionState(
    verifyCedulaAction,
    initialVerifyState,
  );

  // Verified means done here: leave for the next step rather than sitting on
  // the form admiring the success message — which is also what left two of
  // them on screen and nowhere to go.
  useEffect(() => {
    if (state.status !== "verified") return;
    void queryClient.invalidateQueries().then(() => router.push(next));
  }, [state.status, next, queryClient, router]);

  // Narrowed once, so the icon, the tone and the message are known to belong
  // to the same outcome rather than being looked up three separate times.
  const outcome =
    state.status !== "idle" && state.status !== "invalid" && state.message
      ? {
          Icon: OUTCOME_ICON[state.status],
          tone: OUTCOME_TONE[state.status],
          message: state.message,
        }
      : null;

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {/* The Server Action has no route context, so the locale it translates
          with rides along in the post. */}
      <input type="hidden" name="locale" value={locale} />
      <Field>
        <FieldLabel htmlFor="cedula">{t("label")}</FieldLabel>
        <CedulaInput
          placeholder={t("placeholder")}
          describedBy="cedula-help"
          invalid={state.status === "invalid" || state.status === "rejected"}
        />
        <FieldDescription
          id="cedula-help"
          className="flex flex-col items-start gap-1.5"
        >
          <span>
            <ShieldCheck
              className="mr-1 inline size-3.5 align-[-2px]"
              aria-hidden
            />
            {t("help")}
          </span>
          <CedulaPrivacyDrawer />
        </FieldDescription>
        {state.status === "invalid" && <FieldError>{state.message}</FieldError>}
      </Field>

      <Field>
        <FieldLabel htmlFor="municipalityId">{t("municipality")}</FieldLabel>
        <MunicipalityPicker municipalities={municipalities} />
      </Field>

      <SubmitButton />

      {outcome && (
        <p
          // Announced to a screen reader without stealing focus.
          role="status"
          aria-live="polite"
          className={`flex items-start gap-2 text-sm ${outcome.tone}`}
        >
          <outcome.Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{outcome.message}</span>
        </p>
      )}
    </form>
  );
}
