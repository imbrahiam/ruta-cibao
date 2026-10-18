"use client";

import { Collapsible } from "@base-ui/react/collapsible";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronDown,
  FileImage,
  Hourglass,
  ShieldCheck,
} from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useActionState, useEffect, useState } from "react";
import { verifyCedulaAction } from "@/app/[locale]/(onboarding)/verificar/actions";
import { initialVerifyState } from "@/app/[locale]/(onboarding)/verificar/verify-state";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { useRouter } from "@/i18n/navigation";
import { formatCedula } from "@/lib/cedula-format";
import { cx } from "@/lib/cx";
import { type client, orpc } from "@/lib/orpc";

type Status = Awaited<ReturnType<typeof client.identity.status>>;
type Stage = Status["stage"];

const STEPS: Exclude<Stage, "verified">[] = ["cedula", "documents", "review"];

/**
 * Becoming a verified resident, in the three steps it really takes: the
 * registry confirms the cédula, the person sends two photos, and their
 * municipality looks at them. Each step says why it is asked for, and the
 * cédula itself never comes back to the screen.
 */
export function VerificationFlow({
  initialStatus,
  municipalities,
  next,
}: {
  initialStatus: Status;
  municipalities: { id: string; name: string }[];
  next: string;
}) {
  const t = useTranslations("identity");
  const queryClient = useQueryClient();
  const router = useRouter();
  const status = useQuery({
    ...orpc.identity.status.queryOptions(),
    initialData: initialStatus,
  });
  const data = status.data ?? initialStatus;
  const refresh = () => {
    void queryClient.invalidateQueries({
      queryKey: orpc.identity.status.key(),
    });
    void queryClient.invalidateQueries({ queryKey: orpc.me.get.key() });
  };

  if (data.stage === "verified") {
    return (
      <div className="rounded-panel bg-card p-6 shadow-ring animate-rise">
        <span className="flex size-11 items-center justify-center rounded-full bg-accent-soft text-accent">
          <ShieldCheck strokeWidth={1.5} className="size-5" />
        </span>
        <p className="t-h3 mt-4">{t("verified")}</p>
        <ButtonLink href={next as "/mapa"} variant="primary" className="mt-5">
          {t("continue")}
        </ButtonLink>
      </div>
    );
  }

  const current = STEPS.indexOf(data.stage);

  return (
    <div className="flex flex-col gap-6">
      <ol className="grid grid-cols-3 gap-2" aria-label={t("progress")}>
        {STEPS.map((step, index) => (
          <li key={step} aria-current={index === current ? "step" : undefined}>
            <span
              className={cx(
                "block h-1 rounded-full transition-colors duration-500",
                index <= current ? "bg-accent" : "bg-paper-3",
              )}
            />
            <span
              className={cx(
                "t-small mt-2 block",
                index === current ? "font-medium text-ink" : "text-ink-3",
              )}
            >
              {t(`steps.${step}`)}
            </span>
          </li>
        ))}
      </ol>

      <div key={data.stage} className="animate-panel">
        {data.stage === "cedula" ? (
          <CedulaStep municipalities={municipalities} onDone={refresh} />
        ) : data.stage === "documents" ? (
          <DocumentsStep status={data} onDone={refresh} />
        ) : (
          <ReviewStep status={data} onBack={() => router.push("/mapa")} />
        )}
      </div>
    </div>
  );
}

function CedulaStep({
  municipalities,
  onDone,
}: {
  municipalities: { id: string; name: string }[];
  onDone: () => void;
}) {
  const t = useTranslations("onboarding.cedula");
  const locale = useLocale();
  const [state, action, pending] = useActionState(
    verifyCedulaAction,
    initialVerifyState,
  );
  const [cedula, setCedula] = useState("");

  useEffect(() => {
    if (["matched", "pending", "in_review", "verified"].includes(state.status))
      onDone();
  }, [state, onDone]);

  const error = [
    "rejected",
    "taken",
    "check_digit",
    "invalid",
    "invalid_name",
  ].includes(state.status)
    ? state.message
    : null;

  return (
    <form
      action={action}
      className="flex flex-col gap-4 rounded-panel bg-card p-6 shadow-ring"
    >
      <input type="hidden" name="locale" value={locale} />
      <div>
        <p className="t-h3">{t("title")}</p>
        <p className="t-small mt-1 text-ink-2">{t("intro")}</p>
      </div>
      <Field
        htmlFor="cedula"
        label={t("label")}
        hint={t("help")}
        error={
          state.status === "invalid" ||
          state.status === "check_digit" ||
          state.status === "taken"
            ? error
            : undefined
        }
      >
        <Input
          id="cedula"
          name="cedula"
          inputMode="numeric"
          autoComplete="off"
          placeholder={t("placeholder")}
          value={cedula}
          onChange={(event) => setCedula(formatCedula(event.target.value))}
          className="font-mono tracking-wider"
          required
        />
      </Field>
      {state.status === "check_digit" ? (
        <label className="t-small flex items-center gap-2.5 rounded-card bg-paper-2 px-4 py-3 text-ink">
          <input
            type="checkbox"
            name="confirmNumber"
            value="1"
            className="size-4 accent-[var(--accent)]"
          />
          {t("confirmNumber")}
        </label>
      ) : null}
      <Field
        htmlFor="name"
        label={t("nameLabel")}
        error={state.status === "invalid_name" ? error : undefined}
      >
        <Input
          id="name"
          name="name"
          autoComplete="name"
          placeholder={t("namePlaceholder")}
          required
        />
      </Field>
      <Field
        htmlFor="municipalityId"
        label={t("municipality")}
        hint={t("municipalityHelp")}
      >
        <Select
          id="municipalityId"
          name="municipalityId"
          defaultValue=""
          required
        >
          <option value="" disabled>
            {t("municipalityPlaceholder")}
          </option>
          {municipalities.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </Select>
      </Field>
      {state.status === "rejected" ? (
        <p
          role="alert"
          className="t-small rounded-card bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] px-4 py-3 text-ink"
        >
          {error}
        </p>
      ) : null}
      <Button
        type="submit"
        variant="primary"
        size="lg"
        block
        disabled={pending}
      >
        {pending ? t("checking") : t("submit")}
      </Button>
      <PrivacyNote />
    </form>
  );
}

function PrivacyNote() {
  const t = useTranslations("onboarding.cedula.privacy");
  return (
    <Collapsible.Root className="rounded-card bg-paper-2">
      <Collapsible.Trigger className="group flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-[14px] font-medium text-ink">
        {t("trigger")}
        <ChevronDown
          strokeWidth={1.5}
          className="size-4 text-ink-3 transition-transform group-data-[panel-open]:rotate-180"
        />
      </Collapsible.Trigger>
      <Collapsible.Panel className="overflow-hidden px-4 pb-4 transition-[height] duration-300 ease-soft data-[ending-style]:h-0 data-[starting-style]:h-0 [height:var(--collapsible-panel-height)]">
        <ul className="flex flex-col gap-3">
          {(["lookup", "encrypted", "never_shown", "one_vote"] as const).map(
            (key) => (
              <li key={key}>
                <p className="text-[14px] font-medium text-ink">
                  {t(`${key}.title`)}
                </p>
                <p className="t-small text-ink-2">{t(`${key}.body`)}</p>
              </li>
            ),
          )}
        </ul>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}

type Kind = "front" | "selfie" | "residence";

function DocumentsStep({
  status,
  onDone,
}: {
  status: Status;
  onDone: () => void;
}) {
  const t = useTranslations("identity");
  const [files, setFiles] = useState<Partial<Record<Kind, File>>>({});
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rejected = status.review?.status === "rejected" ? status.review : null;

  const submit = async () => {
    if (!files.front || !files.selfie || !consent) return;
    setBusy(true);
    setError(null);
    const body = new FormData();
    body.set("front", files.front);
    body.set("selfie", files.selfie);
    if (files.residence) body.set("residence", files.residence);
    try {
      const response = await fetch("/api/identity/documents", {
        method: "POST",
        body,
      });
      if (!response.ok) {
        const reason = (
          (await response.json().catch(() => ({}))) as { reason?: string }
        ).reason;
        setError(t(`errors.${reason ?? "generic"}` as "errors.generic"));
        return;
      }
      toast.success({ title: t("submitted") });
      onDone();
    } catch {
      setError(t("errors.generic"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-panel bg-card p-6 shadow-ring">
      <div>
        <p className="t-h3">{t("documentsTitle")}</p>
        <p className="t-small mt-1 text-ink-2">{t("documentsHint")}</p>
      </div>
      {status.registryName ? (
        <dl className="grid grid-cols-2 gap-2">
          <div className="rounded-card bg-paper-2 px-4 py-3">
            <dt className="t-label text-ink-3">{t("registryName")}</dt>
            <dd className="mt-1 text-[15px]">{status.registryName}</dd>
          </div>
          <div className="rounded-card bg-paper-2 px-4 py-3">
            <dt className="t-label text-ink-3">{t("municipality")}</dt>
            <dd className="mt-1 text-[15px]">
              {status.municipality?.name ?? "—"}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="t-small rounded-card bg-paper-2 px-4 py-3 text-ink-2">
          {t("registryPending")}
        </p>
      )}
      {rejected ? (
        <div className="rounded-card bg-[color-mix(in_srgb,var(--warning)_12%,transparent)] px-4 py-3">
          <p className="text-[15px] font-medium text-ink">
            {t("rejectedTitle")}
          </p>
          <p className="t-small mt-1 text-ink-2">
            {rejected.reason ? t(`reasons.${rejected.reason}`) : null}
            {rejected.note ? ` · ${rejected.note}` : null}
          </p>
        </div>
      ) : null}
      {(["front", "selfie", "residence"] as const).map((kind) => (
        <FilePick
          key={kind}
          kind={kind}
          file={files[kind]}
          onFile={(file) =>
            setFiles((current) => ({ ...current, [kind]: file }))
          }
        />
      ))}
      <p className="t-small text-ink-3">{t("privacy")}</p>
      <label className="t-small flex items-start gap-2.5 text-ink">
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
        />
        {t("consent")}
      </label>
      {error ? (
        <p role="alert" className="t-small text-danger-ink">
          {error}
        </p>
      ) : null}
      <Button
        variant="primary"
        size="lg"
        block
        disabled={busy || !files.front || !files.selfie || !consent}
        onClick={submit}
      >
        {busy ? t("sending") : t("send")}
      </Button>
    </div>
  );
}

function FilePick({
  kind,
  file,
  onFile,
}: {
  kind: Kind;
  file: File | undefined;
  onFile: (file: File) => void;
}) {
  const t = useTranslations("identity");
  return (
    <label
      className={cx(
        "flex cursor-pointer items-center gap-3 rounded-card px-4 py-3.5 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent",
        file ? "bg-accent-soft" : "bg-paper-2 hover:bg-paper-3",
      )}
    >
      <span
        className={cx(
          "flex size-10 shrink-0 items-center justify-center rounded-full",
          file ? "bg-accent text-on-accent" : "bg-card text-ink-2 shadow-ring",
        )}
      >
        {file ? (
          <Check strokeWidth={2} className="size-[18px]" />
        ) : (
          <FileImage strokeWidth={1.5} className="size-[18px]" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] text-ink">{t(kind)}</span>
        <span className="t-small block truncate text-ink-3">
          {file ? file.name : t(`${kind}Hint`)}
        </span>
      </span>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(event) => {
          const picked = event.target.files?.[0];
          if (picked) onFile(picked);
        }}
      />
    </label>
  );
}

function ReviewStep({
  status,
  onBack,
}: {
  status: Status;
  onBack: () => void;
}) {
  const t = useTranslations("identity");
  const format = useFormatter();
  return (
    <div className="rounded-panel bg-card p-6 shadow-ring">
      <span className="flex size-11 items-center justify-center rounded-full bg-paper-3 text-ink-2">
        <Hourglass strokeWidth={1.5} className="size-5" />
      </span>
      <p className="t-h3 mt-4">{t("reviewTitle")}</p>
      <p className="t-body mt-1.5 text-ink-2">{t("reviewHint")}</p>
      {status.review ? (
        <p className="t-small mt-3 text-ink-3">
          {t("submittedAt", {
            date: format.dateTime(new Date(status.review.submittedAt), "long"),
          })}
        </p>
      ) : null}
      <Button variant="secondary" className="mt-5" onClick={onBack}>
        {t("continue")}
      </Button>
    </div>
  );
}
