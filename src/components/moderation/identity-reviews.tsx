"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, ShieldCheck } from "lucide-react";
import Image from "next/image";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { client, orpc } from "@/lib/orpc";
import type {
  DecideReviewInput,
  IdentityDocumentKind,
  ReviewSummary,
} from "@/modules/identity/contracts";

const REASONS = [
  "unreadable",
  "mismatch",
  "not_resident",
  "incomplete",
  "other",
] as const;

export function IdentityReviews() {
  const t = useTranslations("identity.desk");
  const [status, setStatus] = useState<"pending" | "decided">("pending");
  const items = useQuery({
    ...orpc.identity.reviews.queryOptions({ input: { status, limit: 50 } }),
    refetchInterval: 30_000,
  });
  return (
    <div className="flex flex-col gap-5">
      <Tabs
        value={status}
        onValueChange={(value) => setStatus(value as "pending" | "decided")}
      >
        <TabsList>
          <TabsTrigger value="pending">{t("pending")}</TabsTrigger>
          <TabsTrigger value="decided">{t("decided")}</TabsTrigger>
        </TabsList>
      </Tabs>
      {items.isPending && (
        <p role="status" className="flex items-center gap-2 py-8">
          <Spinner />
          {t("loading")}
        </p>
      )}
      {items.isError && (
        <div role="alert" className="space-y-3">
          <p>{t("error")}</p>
          <Button variant="outline" onClick={() => void items.refetch()}>
            {t("retry")}
          </Button>
        </div>
      )}
      {items.isSuccess && items.data.length === 0 && (
        <p className="surface-card p-8 text-center">
          {t(status === "pending" ? "empty" : "emptyDecided")}
        </p>
      )}
      {items.data?.map((review) => (
        <ReviewCard key={`${review.id}:${review.status}`} review={review} />
      ))}
    </div>
  );
}

function ReviewCard({ review }: { review: ReviewSummary }) {
  const t = useTranslations("identity.desk");
  const identityT = useTranslations("identity");
  const format = useFormatter();
  const queryClient = useQueryClient();
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const [decision, setDecision] = useState<"approve" | "reject" | null>(null);
  const [reason, setReason] = useState<(typeof REASONS)[number]>("unreadable");
  const [note, setNote] = useState("");
  const [viewed, setViewed] = useState<
    Partial<Record<IdentityDocumentKind, boolean>>
  >({});
  const decide = useMutation({
    mutationFn: (input: DecideReviewInput) => client.identity.decide(input),
    onSuccess: async (result) => {
      setDocumentsOpen(false);
      toast.success(t(result.status === "approved" ? "approved" : "rejected"));
      await queryClient.invalidateQueries({ queryKey: orpc.identity.key() });
    },
    onError: async (error) => {
      const data = "data" in error ? (error.data as { reason?: string }) : null;
      const key =
        data?.reason === "registry_pending" || data?.reason === "not_pending"
          ? data.reason
          : "failed";
      toast.error(t(key));
      await queryClient.invalidateQueries({ queryKey: orpc.identity.key() });
    },
  });
  const canApprove = Boolean(
    review.registryName && viewed.front && viewed.selfie,
  );
  return (
    <article className="surface-card flex flex-col gap-4 p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="font-semibold text-lg">
            {review.registryName ?? review.displayName}
          </h2>
          <p className="text-sm text-muted-foreground">
            {review.municipalityName}
          </p>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="size-3.5" aria-hidden />
            {format.dateTime(new Date(review.submittedAt), {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
        </div>
        <Badge variant="secondary">{t(`${review.status}Status`)}</Badge>
      </header>
      {review.previousRejections > 0 && (
        <p className="text-sm">
          {t("previousRejections", { count: review.previousRejections })}
        </p>
      )}
      {!review.registryName && review.status === "pending" && (
        <p className="rounded-lg bg-amber-500/10 p-3 text-sm">
          {t("registryPending")}
        </p>
      )}
      {review.reason && (
        <p className="text-sm">{identityT(`reasons.${review.reason}`)}</p>
      )}
      {review.documentsAvailable ? (
        <>
          <Button
            variant="outline"
            onClick={() => setDocumentsOpen((open) => !open)}
          >
            <ShieldCheck className="size-4" aria-hidden />
            {t(documentsOpen ? "hideDocuments" : "showDocuments")}
          </Button>
          {documentsOpen && (
            <div className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  "front",
                  "selfie",
                  ...(review.hasResidence ? ["residence" as const] : []),
                ] as const
              ).map((kind) => (
                <PrivateDocument
                  key={kind}
                  reviewId={review.id}
                  kind={kind}
                  onViewed={() =>
                    setViewed((current) => ({ ...current, [kind]: true }))
                  }
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">{t("documentsDeleted")}</p>
      )}
      {!review.hasResidence && (
        <p className="text-sm text-muted-foreground">{t("residenceMissing")}</p>
      )}
      {review.status === "pending" && (
        <>
          <p className="text-sm leading-relaxed">{t("checklist")}</p>
          {decision === "approve" && (
            <p className="text-sm">{t("approveHint")}</p>
          )}
          {decision === "reject" && (
            <div className="space-y-4">
              <Field>
                <FieldLabel htmlFor={`reason-${review.id}`}>
                  {t("reason")}
                </FieldLabel>
                <NativeSelect
                  id={`reason-${review.id}`}
                  size="lg"
                  value={reason}
                  disabled={decide.isPending}
                  onChange={(event) =>
                    setReason(event.target.value as typeof reason)
                  }
                >
                  {REASONS.map((value) => (
                    <NativeSelectOption key={value} value={value}>
                      {identityT(`reasons.${value}`)}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor={`note-${review.id}`}>
                  {t("note")}
                </FieldLabel>
                <Textarea
                  id={`note-${review.id}`}
                  maxLength={500}
                  value={note}
                  disabled={decide.isPending}
                  placeholder={t("notePlaceholder")}
                  onChange={(event) => setNote(event.target.value)}
                  aria-describedby={`note-hint-${review.id}`}
                />
                <FieldDescription id={`note-hint-${review.id}`}>
                  {t("noteHint")}
                </FieldDescription>
              </Field>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={
                decide.isPending || !canApprove || !review.documentsAvailable
              }
              className="min-h-11"
              onClick={() => {
                if (decision !== "approve") {
                  setDecision("approve");
                  return;
                }
                decide.mutate({ reviewId: review.id, decision: "approve" });
              }}
            >
              <CheckCircle2 className="size-4" aria-hidden />
              {t(decision === "approve" ? "approveConfirm" : "approve")}
            </Button>
            <Button
              variant="outline"
              disabled={decide.isPending}
              className="min-h-11"
              onClick={() => {
                if (decision !== "reject") {
                  setDecision("reject");
                  return;
                }
                decide.mutate({
                  reviewId: review.id,
                  decision: "reject",
                  reason,
                  note: note.trim() || undefined,
                });
              }}
            >
              {t(decision === "reject" ? "rejectConfirm" : "reject")}
            </Button>
            {decision && (
              <Button
                variant="ghost"
                disabled={decide.isPending}
                onClick={() => setDecision(null)}
              >
                {identityT("cancel")}
              </Button>
            )}
          </div>
        </>
      )}
    </article>
  );
}

function PrivateDocument({
  reviewId,
  kind,
  onViewed,
}: {
  reviewId: string;
  kind: IdentityDocumentKind;
  onViewed: () => void;
}) {
  const t = useTranslations("identity");
  const [source, setSource] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    let objectUrl: string | undefined;
    void (async () => {
      try {
        const response = await fetch(
          `/api/identity/documents/${reviewId}/${kind}`,
          { cache: "no-store", signal: abort.signal },
        );
        if (!response.ok) throw new Error("Private document unavailable");
        const blob = await response.blob();
        if (abort.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setSource(objectUrl);
      } catch {
        if (!abort.signal.aborted) setFailed(true);
      }
    })();
    return () => {
      abort.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [reviewId, kind]);
  return (
    <figure className="space-y-2">
      <figcaption className="font-medium text-sm">{t(kind)}</figcaption>
      {failed ? (
        <p role="alert" className="text-sm text-destructive">
          {t("desk.documentError")}
        </p>
      ) : source ? (
        <Image
          src={source}
          alt={t(kind)}
          width={1600}
          height={1600}
          unoptimized
          className="h-auto max-h-[36rem] w-full rounded-lg object-contain"
          onLoad={onViewed}
          onError={() => setFailed(true)}
        />
      ) : (
        <p role="status">
          <Spinner />
          {t("desk.loading")}
        </p>
      )}
    </figure>
  );
}
