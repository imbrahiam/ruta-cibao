"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useAuth } from "@/components/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { toast } from "@/components/ui/toast";
import { cx } from "@/lib/cx";
import { newIdempotencyKey, sendOrQueue } from "@/lib/offline/submit";
import { client } from "@/lib/orpc";

const REASONS = [
  "incorrect_information",
  "closed",
  "duplicate",
  "wrong_location",
  "other",
] as const;
type Reason = (typeof REASONS)[number];

export function ReportPlaceSheet({
  open,
  onOpenChange,
  placeId,
  placeName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placeId: string;
  placeName: string;
}) {
  const t = useTranslations("place.reportForm");
  const { viewer } = useAuth();
  const [reason, setReason] = useState<Reason | null>(null);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const needsDetails = reason === "other" && details.trim().length < 10;

  const submit = async () => {
    if (!reason || !viewer?.userId || needsDetails) return;
    setBusy(true);
    setError(null);
    const requestId = newIdempotencyKey();
    const input = {
      requestId,
      placeId,
      reason,
      details: details.trim() || undefined,
    };
    try {
      const outcome = await sendOrQueue({
        procedure: "places.report",
        input,
        userId: viewer.userId,
        idempotencyKey: requestId,
        labelKey: "pending.labels.placeReport",
        send: () => client.places.report(input),
      });
      toast.success({ title: outcome.queued ? t("queued") : t("sent") });
      setReason(null);
      setDetails("");
      onOpenChange(false);
    } catch {
      setError(t("failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("title")}
      description={t("description", { name: placeName })}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button
            variant="primary"
            disabled={!reason || needsDetails || busy}
            onClick={submit}
          >
            {busy ? t("sending") : t("submit")}
          </Button>
        </>
      }
    >
      <fieldset>
        <legend className="sr-only">{t("reasonLegend")}</legend>
        <div className="flex flex-col gap-2">
          {REASONS.map((value) => (
            <label
              key={value}
              className={cx(
                "flex min-h-12 cursor-pointer items-center gap-3 rounded-card px-4 text-[15px] shadow-ring transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent",
                reason === value
                  ? "bg-accent-soft text-ink shadow-[0_0_0_1.5px_var(--accent)]"
                  : "bg-card hover:bg-paper-2",
              )}
            >
              <input
                type="radio"
                name="reason"
                value={value}
                checked={reason === value}
                onChange={() => setReason(value)}
                className="size-4 accent-[var(--accent)]"
              />
              {t(`reasons.${value}`)}
            </label>
          ))}
        </div>
      </fieldset>
      <Field
        className="mt-5"
        htmlFor="report-details"
        label={t("details")}
        optional={reason === "other" ? undefined : t("optional")}
        hint={t("detailsHint")}
        error={
          reason === "other" && details.length > 0 && needsDetails
            ? t("detailsRequired")
            : (error ?? undefined)
        }
      >
        <Textarea
          id="report-details"
          value={details}
          maxLength={500}
          onChange={(event) => setDetails(event.target.value)}
        />
      </Field>
    </Sheet>
  );
}
