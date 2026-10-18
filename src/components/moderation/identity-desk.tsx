"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Eye, EyeOff, ShieldCheck, X } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { useAuth } from "@/components/auth/auth-context";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Select, Textarea } from "@/components/ui/field";
import { Placeholder } from "@/components/ui/loading";
import { Segmented } from "@/components/ui/segmented";
import { Tag } from "@/components/ui/tag";
import { toast } from "@/components/ui/toast";
import { Link } from "@/i18n/navigation";
import { errorReason } from "@/lib/errors";
import { type client, orpc } from "@/lib/orpc";

type Review = Awaited<ReturnType<typeof client.identity.reviews>>[number];
const REASONS = [
  "unreadable",
  "mismatch",
  "not_resident",
  "incomplete",
  "other",
] as const;

/**
 * Verifying residents. The photos are private, so they load only when a
 * moderator asks to see them, and are never cached in a list. The checklist
 * says what to compare before approving.
 */
export function IdentityDesk() {
  const t = useTranslations("identity.desk");
  const { isStaff, isLoading } = useAuth();
  const [status, setStatus] = useState<"pending" | "decided">("pending");
  const reviews = useQuery({
    ...orpc.identity.reviews.queryOptions({ input: { status, limit: 30 } }),
    enabled: isStaff,
  });

  if (isLoading) return <Placeholder className="h-96" />;
  if (!isStaff) return <EmptyState icon={ShieldCheck} title={t("forbidden")} />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/moderacion"
          className="t-small inline-flex items-center gap-1.5 text-ink-2 hover:text-ink"
        >
          <ArrowLeft strokeWidth={1.5} className="size-4" />
          {t("back")}
        </Link>
        <Segmented
          label={t("title")}
          value={status}
          onChange={setStatus}
          options={[
            { value: "pending", label: t("pending") },
            { value: "decided", label: t("decided") },
          ]}
        />
      </div>
      <p className="t-small rounded-card bg-paper-2 px-5 py-4 text-ink-2">
        {t("checklist")}
      </p>
      {reviews.isPending ? (
        <Placeholder className="h-48" />
      ) : !reviews.data?.length ? (
        <EmptyState
          icon={Check}
          title={status === "pending" ? t("empty") : t("emptyDecided")}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {reviews.data.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ReviewCard({ review }: { review: Review }) {
  const t = useTranslations("identity.desk");
  const tReasons = useTranslations("identity.reasons");
  const format = useFormatter();
  const queryClient = useQueryClient();
  const municipalities = useQuery(orpc.municipalities.list.queryOptions());
  const [showDocs, setShowDocs] = useState(false);
  const [mode, setMode] = useState<"idle" | "reject">("idle");
  const [reason, setReason] = useState<(typeof REASONS)[number]>("unreadable");
  const [note, setNote] = useState("");
  const [municipalityId, setMunicipalityId] = useState(review.municipalityId);
  const decide = useMutation(
    orpc.identity.decide.mutationOptions({
      onSuccess: (result) => {
        toast.success({
          title: result.status === "approved" ? t("approved") : t("rejected"),
        });
        void queryClient.invalidateQueries({ queryKey: orpc.identity.key() });
      },
      onError: (error) =>
        toast.error({
          title:
            errorReason(error) === "registry_pending"
              ? t("registry_pending")
              : t("failed"),
        }),
    }),
  );
  const kinds = review.hasResidence
    ? (["front", "selfie", "residence"] as const)
    : (["front", "selfie"] as const);

  return (
    <li className="rounded-card bg-card p-5 shadow-ring">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[17px] font-medium tracking-[-0.012em] text-ink">
            {review.registryName ?? review.displayName}
          </p>
          <p className="t-small mt-0.5 text-ink-3">
            {t("meta", {
              name: review.displayName,
              municipality: review.municipalityName,
              date: format.dateTime(new Date(review.submittedAt), "short"),
            })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Tag
            tone={
              review.status === "pending"
                ? "warning"
                : review.status === "approved"
                  ? "success"
                  : "danger"
            }
          >
            {t(`${review.status}Status`)}
          </Tag>
          {review.previousRejections > 0 ? (
            <Tag>
              {t("previousRejections", { count: review.previousRejections })}
            </Tag>
          ) : null}
          {!review.registryName ? (
            <Tag tone="warning">{t("registryPendingTag")}</Tag>
          ) : null}
        </div>
      </div>
      {review.reason ? (
        <p className="t-small mt-2 text-ink-2">{tReasons(review.reason)}</p>
      ) : null}

      {review.documentsAvailable ? (
        <div className="mt-4">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setShowDocs(!showDocs)}
          >
            {showDocs ? (
              <EyeOff strokeWidth={1.5} />
            ) : (
              <Eye strokeWidth={1.5} />
            )}
            {showDocs ? t("hideDocuments") : t("showDocuments")}
          </Button>
          {showDocs ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {kinds.map((kind) => (
                <figure
                  key={kind}
                  className="overflow-hidden rounded-[12px] bg-paper-2"
                >
                  {/* biome-ignore lint/performance/noImgElement: private documents streamed per request, never optimised or cached */}
                  <img
                    src={`/api/identity/documents/${review.id}/${kind}`}
                    alt={t(`doc.${kind}`)}
                    className="h-48 w-full object-cover"
                  />
                  <figcaption className="t-small px-3 py-2 text-ink-2">
                    {t(`doc.${kind}`)}
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <p className="t-small mt-4 text-ink-3">{t("documentsDeleted")}</p>
      )}

      {review.status === "pending" ? (
        mode === "reject" ? (
          <div className="mt-4 flex flex-col gap-3 rounded-card bg-paper-2 p-4">
            <Field htmlFor={`reason-${review.id}`} label={t("reason")}>
              <Select
                id={`reason-${review.id}`}
                value={reason}
                onChange={(event) =>
                  setReason(event.target.value as typeof reason)
                }
              >
                {REASONS.map((value) => (
                  <option key={value} value={value}>
                    {tReasons(value)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              htmlFor={`note-${review.id}`}
              label={t("note")}
              hint={t("noteHint")}
            >
              <Textarea
                id={`note-${review.id}`}
                value={note}
                maxLength={500}
                onChange={(event) => setNote(event.target.value)}
                className="min-h-20"
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setMode("idle")}>
                {t("cancel")}
              </Button>
              <Button
                size="sm"
                variant="primary"
                disabled={decide.isPending}
                onClick={() =>
                  decide.mutate({
                    reviewId: review.id,
                    decision: "reject",
                    reason,
                    note: note.trim() || undefined,
                  })
                }
              >
                {t("rejectConfirm")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-line/60 pt-4">
            <Field
              htmlFor={`municipality-${review.id}`}
              label={t("municipality")}
              className="min-w-52"
            >
              <Select
                id={`municipality-${review.id}`}
                value={municipalityId}
                onChange={(event) => setMunicipalityId(event.target.value)}
              >
                {(municipalities.data ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setMode("reject")}
              >
                <X strokeWidth={1.75} />
                {t("reject")}
              </Button>
              <Button
                size="sm"
                variant="primary"
                disabled={decide.isPending || !review.registryName}
                onClick={() =>
                  decide.mutate({
                    reviewId: review.id,
                    decision: "approve",
                    municipalityId,
                  })
                }
              >
                <Check strokeWidth={1.75} />
                {t("approve")}
              </Button>
            </div>
          </div>
        )
      ) : null}
    </li>
  );
}
