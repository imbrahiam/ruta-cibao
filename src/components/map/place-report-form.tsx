"use client";

import { ArrowLeft, Flag } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useSignInHref } from "@/hooks/use-sign-in-href";
import { Link } from "@/i18n/navigation";
import { markInstallMoment } from "@/lib/install-moment";
import { enqueue, newIdempotencyKey } from "@/lib/offline/queue";
import { client } from "@/lib/orpc";
import type { ReportPlaceInput } from "@/modules/places/contracts";

const REASONS = [
  "incorrect_information",
  "closed",
  "duplicate",
  "wrong_location",
  "other",
] as const satisfies ReportPlaceInput["reason"][];

export function PlaceReportForm({
  placeId,
  placeName,
  onCancel,
  onDone,
}: {
  placeId: string;
  placeName: string;
  onCancel: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("map.place.reportForm");
  const signInHref = useSignInHref();
  const { viewer, isLoading, isUnavailable } = useAuth();
  const [reason, setReason] = useState<ReportPlaceInput["reason"] | "">("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reason || !viewer?.userId) {
      setError(t("reasonRequired"));
      return;
    }

    const form = new FormData(event.currentTarget);
    const details = String(form.get("details") ?? "").trim();
    if (reason === "other" && details.length < 10) {
      setError(t("detailsRequired"));
      return;
    }

    const requestId = newIdempotencyKey();
    const input: ReportPlaceInput = {
      requestId,
      placeId,
      reason,
      details: details || undefined,
    };

    setSubmitting(true);
    setError(null);

    try {
      if (!navigator.onLine) {
        await enqueue({
          procedure: "places.report",
          userId: viewer.userId,
          input,
          idempotencyKey: requestId,
          labelKey: "map.place.reportForm.queued",
        });
        toast.success(t("queued"));
        markInstallMoment();
      } else {
        await client.places.report(input);
        toast.success(t("sent"));
        markInstallMoment();
      }
      onDone();
    } catch {
      setError(t("failed"));
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <p
        className="flex min-h-40 items-center justify-center gap-2 px-5 text-muted-foreground text-sm"
        role="status"
      >
        <Spinner className="size-4" /> {t("checkingAccount")}
      </p>
    );
  }

  if (isUnavailable) {
    return (
      <p
        className="m-5 rounded-xl border bg-muted/40 p-5 text-center text-muted-foreground text-sm leading-relaxed"
        role="status"
      >
        {t("accountUnavailable")}
      </p>
    );
  }

  if (viewer?.kind === "anonymous") {
    return (
      <div className="flex flex-col gap-5 px-5 pt-5 pb-8 text-left">
        <Button variant="ghost" className="w-fit" onClick={onCancel}>
          <ArrowLeft aria-hidden />
          {t("back")}
        </Button>
        <div className="space-y-2 rounded-xl border bg-muted/35 p-5">
          <p className="font-medium">{t("signInTitle")}</p>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {t("signInDescription")}
          </p>
          <Button
            className="mt-3 h-11 w-full"
            nativeButton={false}
            render={<Link href={signInHref} />}
          >
            {t("signIn")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="space-y-5 px-5 pt-5 pb-8 text-left"
      onSubmit={handleSubmit}
    >
      <Button
        type="button"
        variant="ghost"
        className="w-fit"
        onClick={onCancel}
      >
        <ArrowLeft aria-hidden />
        {t("back")}
      </Button>

      <div className="space-y-1">
        <h3 className="font-heading font-semibold text-lg">{t("title")}</h3>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {t("description", { name: placeName })}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="report-reason">{t("reason")}</Label>
        <NativeSelect
          id="report-reason"
          size="lg"
          className="w-full"
          value={reason}
          onChange={(event) =>
            setReason(event.target.value as ReportPlaceInput["reason"] | "")
          }
          required
        >
          <NativeSelectOption value="">
            {t("reasonPlaceholder")}
          </NativeSelectOption>
          {REASONS.map((value) => (
            <NativeSelectOption key={value} value={value}>
              {t(`reasons.${value}`)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      <div className="space-y-2">
        <Label htmlFor="report-details">{t("details")}</Label>
        <Textarea
          id="report-details"
          name="details"
          placeholder={t("detailsPlaceholder")}
          maxLength={500}
        />
        <p className="text-muted-foreground text-xs leading-relaxed">
          {t("detailsHint")}
        </p>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg bg-destructive/10 p-3 text-destructive text-sm"
        >
          {error}
        </p>
      )}

      <Button type="submit" className="h-12 w-full" disabled={submitting}>
        {submitting ? (
          <Spinner className="size-5" />
        ) : (
          <Flag className="size-5" aria-hidden />
        )}
        {submitting ? t("sending") : t("submit")}
      </Button>
    </form>
  );
}
