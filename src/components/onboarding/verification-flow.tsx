"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, ShieldCheck } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { CedulaForm } from "@/components/onboarding/cedula-form";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Link, useRouter } from "@/i18n/navigation";
import { client, orpc } from "@/lib/orpc";
import type { VerificationStatus } from "@/modules/identity/contracts";

const DOCUMENT_KINDS = ["front", "selfie", "residence"] as const;
const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function VerificationFlow({
  initialStatus,
  municipalities,
  next,
}: {
  initialStatus: VerificationStatus;
  municipalities: { id: string; name: string }[];
  next: string;
}) {
  const t = useTranslations("identity");
  const format = useFormatter();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [changing, setChanging] = useState(false);
  const status = useQuery({
    ...orpc.identity.status.queryOptions(),
    initialData: initialStatus,
    refetchInterval: (query) =>
      query.state.data?.stage === "review" ||
      query.state.data?.cedulaStatus === "pending"
        ? 30_000
        : false,
  });
  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: orpc.identity.status.key(),
    });
    await queryClient.invalidateQueries({ queryKey: orpc.me.get.key() });
    router.refresh();
  }, [queryClient, router]);
  const restart = useMutation({
    mutationFn: () => client.identity.restart(),
    onSuccess: async () => {
      setChanging(false);
      await refresh();
    },
  });
  const current = status.data;

  return (
    <div className="flex flex-col gap-6">
      <header className="space-y-2">
        <h1 className="page-title">{t("title")}</h1>
        <p className="page-lede">{t("intro")}</p>
      </header>
      <ol className="flex flex-wrap gap-2 text-sm" aria-label={t("title")}>
        {(["cedula", "documents", "review"] as const).map((step) => (
          <li
            key={step}
            aria-current={current.stage === step ? "step" : undefined}
            className={`rounded-full px-3 py-2 ${current.stage === step ? "bg-primary text-primary-foreground font-medium" : "bg-muted text-muted-foreground"}`}
          >
            {t(`steps.${step}`)}
          </li>
        ))}
      </ol>
      {status.isError && (
        <div role="alert" className="space-y-2">
          <p>{t("loadError")}</p>
          <Button variant="outline" onClick={() => void status.refetch()}>
            {t("retry")}
          </Button>
        </div>
      )}
      {current.stage === "cedula" && (
        <CedulaForm
          municipalities={municipalities}
          next={next}
          onProgress={refresh}
        />
      )}
      {current.stage === "documents" && (
        <>
          {current.review?.status === "rejected" && (
            <section
              className="rounded-xl border border-amber-500/40 p-4"
              role="status"
            >
              <h2 className="font-semibold">{t("rejectedTitle")}</h2>
              <p className="mt-2 text-sm">
                {current.review.reason
                  ? t(`reasons.${current.review.reason}`)
                  : t("rejectedHint")}
              </p>
              {current.review.note && (
                <p className="mt-2 whitespace-pre-wrap text-sm">
                  {current.review.note}
                </p>
              )}
            </section>
          )}
          <section className="rounded-xl bg-muted p-4 text-sm space-y-2">
            {current.registryName && (
              <p>
                <span className="font-medium">{t("registryName")}: </span>
                {current.registryName}
              </p>
            )}
            {current.municipality && (
              <p>
                <span className="font-medium">{t("municipality")}: </span>
                {current.municipality.name}
              </p>
            )}
            {!current.registryName && <p>{t("registryPending")}</p>}
          </section>
          <DocumentForm onSubmitted={refresh} />
          {changing ? (
            <div className="space-y-3">
              <p className="text-sm">{t("restartHint")}</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={restart.isPending}
                  onClick={() => restart.mutate()}
                >
                  {t("restartConfirm")}
                </Button>
                <Button
                  variant="ghost"
                  disabled={restart.isPending}
                  onClick={() => setChanging(false)}
                >
                  {t("cancel")}
                </Button>
              </div>
              {restart.isError && (
                <p role="alert" className="text-destructive text-sm">
                  {t("errors.generic")}
                </p>
              )}
            </div>
          ) : (
            <Button variant="ghost" onClick={() => setChanging(true)}>
              {t("restart")}
            </Button>
          )}
        </>
      )}
      {current.stage === "review" && (
        <section className="surface-card space-y-3 p-5" role="status">
          <Clock className="size-6 text-primary" aria-hidden />
          <h2 className="font-semibold">{t("reviewTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("reviewHint")}</p>
          {!current.registryName && (
            <p className="text-sm">{t("registryPending")}</p>
          )}
          {current.review && (
            <p className="text-xs text-muted-foreground">
              {t("submittedAt", {
                date: format.dateTime(new Date(current.review.submittedAt), {
                  dateStyle: "medium",
                }),
              })}
            </p>
          )}
        </section>
      )}
      {current.stage === "verified" && (
        <section
          className="flex items-center gap-3 rounded-xl bg-emerald-500/10 p-4"
          role="status"
        >
          <CheckCircle2 className="size-5 shrink-0" aria-hidden />
          {t("verified")}
        </section>
      )}
      <Button
        variant="outline"
        nativeButton={false}
        render={<Link href={next} />}
      >
        {t("continue")}
      </Button>
    </div>
  );
}

function DocumentForm({
  onSubmitted,
}: {
  onSubmitted: () => Promise<unknown>;
}) {
  const t = useTranslations("identity");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        setError(null);
        for (const kind of DOCUMENT_KINDS) {
          const file = data.get(kind);
          if (!(file instanceof File) || file.size === 0) {
            if (kind === "residence") {
              data.delete(kind);
              continue;
            }
            setError(t("errors.missing_file"));
            return;
          }
          if (file.size > MAX_BYTES || !ACCEPTED_TYPES.has(file.type)) {
            setError(t("errors.invalid_file"));
            return;
          }
        }
        setPending(true);
        try {
          const response = await fetch("/api/identity/documents", {
            method: "POST",
            body: data,
          });
          if (!response.ok) {
            const body = await response.json().catch(() => null);
            const reason = body?.reason;
            const known = [
              "invalid_file",
              "missing_file",
              "too_many",
              "unauthorized",
              "already_submitted",
              "cedula_required",
            ] as const;
            const key = known.find((value) => value === reason) ?? "generic";
            setError(t(`errors.${key}`));
            if (reason === "already_submitted") await onSubmitted();
            return;
          }
          form.reset();
          await onSubmitted();
        } catch {
          setError(t("errors.generic"));
        } finally {
          setPending(false);
        }
      }}
    >
      <div className="space-y-2">
        <h2 className="font-semibold text-lg">{t("documentsTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("documentsHint")}</p>
      </div>
      {DOCUMENT_KINDS.map((kind) => (
        <Field key={kind}>
          <FieldLabel htmlFor={`identity-${kind}`}>{t(kind)}</FieldLabel>
          <Input
            id={`identity-${kind}`}
            name={kind}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required={kind !== "residence"}
            disabled={pending}
            className="h-auto min-h-11 py-2"
            aria-describedby={`identity-${kind}-hint`}
          />
          <FieldDescription id={`identity-${kind}-hint`}>
            {t(`${kind}Hint`)} {t("fileHint")}
          </FieldDescription>
        </Field>
      ))}
      <p className="text-sm text-muted-foreground">
        <ShieldCheck className="mr-2 inline size-4" aria-hidden />
        {t("privacy")}
      </p>
      <label className="flex min-h-11 items-start gap-3 text-sm">
        <input
          type="checkbox"
          required
          disabled={pending}
          className="mt-1 size-5 shrink-0 accent-primary"
        />
        <span>{t("consent")}</span>
      </label>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" className="min-h-12" disabled={pending}>
        {pending && <Spinner />}
        {pending ? t("sending") : t("send")}
      </Button>
    </form>
  );
}
