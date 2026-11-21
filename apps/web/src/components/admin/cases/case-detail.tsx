"use client";

import type { ApiInputs, ApiOutputs } from "@ruta/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessagesSquare } from "lucide-react";
import { useState } from "react";
import { useFormatter, useTranslations } from "use-intl";
import { ErrorPanel, InlineError } from "@/components/admin/error-panel";
import { MetaList, PropertyList, PropertyRow } from "@/components/admin/facts";
import { FormField } from "@/components/admin/form-field";
import { useOutcome } from "@/components/admin/outcome";
import {
  AdminEmpty,
  AdminPageHeader,
  AdminSection,
} from "@/components/admin/page-frame";
import { adjustCount } from "@/components/admin/queue/optimistic";
import { CaseDetailSkeleton } from "@/components/admin/skeletons";
import { useStaff } from "@/components/admin/staff-context";
import { useStaffMutation } from "@/components/admin/use-staff-mutation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api, orpc } from "@/lib/web/api";
import { failureKind } from "@/lib/web/errors";
import { CasePhotos } from "./case-photos";
import { CaseStatusTag, PublicationTag } from "./case-tags";

type Detail = ApiOutputs["consultations"]["detail"];
type ReplyInput = Omit<ApiInputs["consultations"]["respond"], "requestId">;
type PublicationInput = Omit<
  ApiInputs["moderation"]["decidePublication"],
  "requestId"
>;

const REPLY_STATUSES = [
  "in_review",
  "answered",
  "resolved",
  "rejected",
] as const;
const BODY_MIN = 10;
const BODY_MAX = 2000;
const REASON_MIN = 10;

/**
 * Whether the moderation desk lists the case (and the sidebar counts it): it
 * waits for a decision, or it is published and still waits for an answer.
 */
function waiting(
  publication: Detail["publicationStatus"],
  status: Detail["status"],
): 0 | 1 {
  return publication === "pending" ||
    (publication === "published" &&
      (status === "open" || status === "in_review"))
    ? 1
    : 0;
}

/** One case, its official replies and the two things staff can do to it. */
export function CaseDetail({ slug }: { slug: string }) {
  const t = useTranslations("admin");
  const c = useTranslations("admin.cases");
  const consultations = useTranslations("consultations");
  const format = useFormatter();
  const query = useQuery(
    orpc.consultations.detail.queryOptions({ input: { slug } }),
  );

  // A background refetch that fails (a case hidden a moment ago, a dropped
  // connection) must not blank a case the reviewer is reading: data wins.
  if (!query.data) {
    return (
      <div className="flex flex-col gap-6">
        {query.isPending ? (
          <div role="status" aria-busy="true">
            <span className="sr-only">{t("loading")}</span>
            <CaseDetailSkeleton />
          </div>
        ) : failureKind(query.error) === "not_found" ? (
          <AdminEmpty icon={MessagesSquare} title={consultations("missing")} />
        ) : (
          <ErrorPanel error={query.error} onRetry={() => query.refetch()} />
        )}
      </div>
    );
  }

  const item = query.data;

  return (
    <article className="flex flex-col gap-8" aria-busy={query.isFetching}>
      <AdminPageHeader
        title={item.title}
        badge={<CaseStatusTag status={item.status} />}
        description={
          <MetaList>
            {item.municipalityName}
            {item.categoryName}
            {consultations("supports", { count: item.supportCount })}
          </MetaList>
        }
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
        <div className="flex min-w-0 flex-col gap-8">
          <AdminSection id="case-body" title={c("caseText")}>
            <p className="text-sm leading-relaxed whitespace-pre-line">
              {item.body}
            </p>
            {item.photos && item.photos.length > 0 && (
              <CasePhotos
                photos={item.photos}
                label={(index) => c("photoOpen", { n: index + 1 })}
              />
            )}
          </AdminSection>

          {/* With no answer yet the reply form is the next step: an empty
              "Respuestas" block above it only pushed it down. */}
          {item.responses.length === 0 ? null : (
            <AdminSection
              id="timeline"
              title={consultations("timeline")}
              count={item.responses.length}
            >
              <ol className="flex flex-col gap-6">
                {item.responses.map((response) => (
                  <li
                    key={response.id}
                    className="flex flex-col gap-1.5 py-4 first:pt-1 last:pb-0"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                      <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                        <span className="font-medium">
                          {response.author ?? c("officialAnonymous")}
                        </span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {format.dateTime(
                            new Date(response.createdAt),
                            "short",
                          )}{" "}
                          {format.dateTime(
                            new Date(response.createdAt),
                            "time",
                          )}
                        </span>
                      </p>
                      <span>
                        <span className="sr-only">
                          {c("statusAfterReply", {
                            status: consultations(
                              `statusLabel.${response.statusAfter}`,
                            ),
                          })}
                        </span>
                        <span aria-hidden>
                          <CaseStatusTag status={response.statusAfter} />
                        </span>
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed whitespace-pre-line">
                      {response.body}
                    </p>
                  </li>
                ))}
              </ol>
            </AdminSection>
          )}

          <ReplyForm consultation={item} />
        </div>

        <aside
          aria-label={c("facts")}
          className="order-first min-w-0 lg:order-none lg:self-stretch lg:pl-8"
        >
          <div className="flex flex-col gap-5 lg:sticky lg:top-6">
            <PublicationControl consultation={item} />
            <PropertyList>
              <PropertyRow label={c("colDate")}>
                {format.dateTime(new Date(item.createdAt), "long")}
              </PropertyRow>
              <PropertyRow label={c("openedByLabel")}>
                {item.openedBy}
              </PropertyRow>
              <PropertyRow label={c("location")}>
                {item.location ? (
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${item.location.lat}&mlon=${item.location.lng}#map=17/${item.location.lat}/${item.location.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-9 items-center text-primary underline-offset-4 hover:underline pointer-coarse:min-h-11"
                  >
                    {c("viewOnMap")}
                  </a>
                ) : null}
              </PropertyRow>
            </PropertyList>
          </div>
        </aside>
      </div>
    </article>
  );
}

/**
 * The official reply. The status the case ends in is chosen explicitly: what
 * an official writes and what they promise are two different things, and the
 * platform must not guess one from the other.
 */
function ReplyForm({ consultation }: { consultation: Detail }) {
  const t = useTranslations("admin");
  const c = useTranslations("admin.cases");
  const consultations = useTranslations("consultations");
  const announce = useOutcome();
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const [statusAfter, setStatusAfter] = useState<
    ReplyInput["statusAfter"] | ""
  >("");
  const [bodyTouched, setBodyTouched] = useState(false);

  const length = body.trim().length;
  const bodyError =
    length < BODY_MIN
      ? c("errBodyShort")
      : length > BODY_MAX
        ? c("errBodyLong")
        : null;
  const valid = bodyError === null && statusAfter !== "";

  const detailKey = orpc.consultations.detail.queryOptions({
    input: { slug: consultation.slug },
  }).queryKey;
  const author = useStaff().displayName ?? null;

  // The reply joins the timeline and the case takes its new status before the
  // server answers; a refusal takes both back and gives the text back.
  const reply = useStaffMutation<
    ReplyInput,
    { status: "ok" },
    { tempId: string; previousStatus: Detail["status"] }
  >((input) => api.consultations.respond(input), {
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: detailKey });
      const tempId = `pending-${crypto.randomUUID()}`;
      queryClient.setQueryData(detailKey, (old: Detail | undefined) =>
        old
          ? {
              ...old,
              status: input.statusAfter,
              responseCount: old.responseCount + 1,
              responses: [
                ...old.responses,
                {
                  id: tempId,
                  body: input.body,
                  author,
                  statusAfter: input.statusAfter,
                  createdAt: new Date().toISOString(),
                },
              ],
            }
          : old,
      );
      setBody("");
      setStatusAfter("");
      setBodyTouched(false);
      return { tempId, previousStatus: consultation.status };
    },
    onSuccess: () => announce(c("replied")),
    onError: (error, input, context) => {
      if (context) {
        queryClient.setQueryData(detailKey, (old: Detail | undefined) =>
          old
            ? {
                ...old,
                status: context.previousStatus,
                responseCount: old.responseCount - 1,
                responses: old.responses.filter(
                  (response) => response.id !== context.tempId,
                ),
              }
            : old,
        );
      }
      setBody(input.body);
      setStatusAfter(input.statusAfter);
      if (failureKind(error) === "conflict") {
        void queryClient.invalidateQueries({
          queryKey: orpc.consultations.key(),
        });
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: orpc.consultations.key(),
      });
      void queryClient.invalidateQueries({ queryKey: orpc.moderation.key() });
    },
  });

  const submit = () => {
    setBodyTouched(true);
    if (!valid) {
      // The button is never disabled, so a press that cannot go through
      // takes the reviewer to the first thing missing.
      const first = bodyError
        ? document.getElementById("reply-body")
        : document.querySelector<HTMLInputElement>(
            'input[name="status-after"]',
          );
      first?.focus();
      return;
    }
    reply.mutate({
      consultationId: consultation.id,
      body: body.trim(),
      statusAfter,
    });
  };

  return (
    <AdminSection id="reply" title={c("replyTitle")}>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (!reply.isPending) submit();
        }}
        className="flex flex-col gap-5"
      >
        <FormField
          htmlFor="reply-body"
          label={c("replyBody")}
          hint={c("replyHint", { count: length })}
          error={bodyTouched ? bodyError : null}
        >
          <Textarea
            id="reply-body"
            value={body}
            rows={4}
            className="min-h-24"
            required
            aria-invalid={bodyTouched && bodyError !== null}
            aria-describedby={
              bodyTouched && bodyError ? "reply-body-error" : "reply-body-hint"
            }
            disabled={reply.isPending}
            onChange={(event) => setBody(event.target.value)}
            onBlur={() => setBodyTouched(true)}
          />
        </FormField>

        <fieldset className="flex flex-col gap-1" disabled={reply.isPending}>
          <legend className="mb-1 text-sm font-medium">
            {c("statusAfter")}
          </legend>
          {/* Pulled out by the options' own padding, so each radio lines up
              with the legend and the field above instead of sitting indented. */}
          <div className="-mx-3 grid gap-x-4 sm:grid-cols-2">
            {REPLY_STATUSES.map((value) => (
              <label
                key={value}
                className="flex min-h-9 cursor-pointer items-start gap-3 rounded-(--radius-field) px-3 py-2 hover:bg-accent has-[:focus-visible]:ring-[1.5px] has-[:focus-visible]:ring-ring/40 pointer-coarse:min-h-11"
              >
                <input
                  type="radio"
                  name="status-after"
                  value={value}
                  checked={statusAfter === value}
                  onChange={() => setStatusAfter(value)}
                  className="mt-0.5 size-4 shrink-0 accent-primary"
                />
                <span className="flex flex-col">
                  <span className="text-sm font-medium">
                    {consultations(`statusLabel.${value}`)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {c(`statusHelp.${value}`)}
                  </span>
                </span>
              </label>
            ))}
          </div>
          {bodyTouched && statusAfter === "" ? (
            <p role="alert" className="text-sm text-destructive">
              {c("errStatus")}
            </p>
          ) : null}
        </fieldset>

        <InlineError error={reply.error} />

        <div className="flex">
          {/* Never greyed out before anyone tried: a press shows what is
              missing, next to the field it concerns. */}
          <Button type="submit" disabled={reply.isPending}>
            {reply.isPending ? c("sending") : t("respond")}
          </Button>
        </div>
      </form>
    </AdminSection>
  );
}

/**
 * Publish or hide the case. Hiding says why, in words, to the person who
 * opened it, so the reason is typed and checked before the button enables.
 */
function PublicationControl({ consultation }: { consultation: Detail }) {
  const c = useTranslations("admin.cases");
  const t = useTranslations("admin");
  const common = useTranslations("common");
  const announce = useOutcome();
  const queryClient = useQueryClient();
  const [hiding, setHiding] = useState(false);
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);

  const current = consultation.publicationStatus;
  const reasonError = reason.trim().length < REASON_MIN ? c("errReason") : null;

  const detailKey = orpc.consultations.detail.queryOptions({
    input: { slug: consultation.slug },
  }).queryKey;

  const decide = useStaffMutation<
    PublicationInput,
    { status: "published" | "hidden" },
    { undoCount: () => void }
  >((input) => api.moderation.decidePublication(input), {
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: detailKey });
      // Show the new state at once: once a case is hidden the detail read
      // may no longer be open to staff, and a refetch must not blank it.
      queryClient.setQueryData(detailKey, (old: Detail | undefined) =>
        old ? { ...old, publicationStatus: input.status } : old,
      );
      setHiding(false);
      setReason("");
      setTouched(false);
      return {
        undoCount: adjustCount(
          queryClient,
          "consultations",
          waiting(input.status, consultation.status) -
            waiting(current, consultation.status),
        ),
      };
    },
    onSuccess: () => announce(c("publicationDone")),
    onError: (error, input, context) => {
      context?.undoCount();
      queryClient.setQueryData(detailKey, (old: Detail | undefined) =>
        old ? { ...old, publicationStatus: current } : old,
      );
      if (input.status === "hidden") {
        setHiding(true);
        setReason(input.reason ?? "");
        setTouched(true);
      }
      if (failureKind(error) === "conflict") {
        void queryClient.invalidateQueries({
          queryKey: orpc.consultations.key(),
        });
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: orpc.consultations.browse.key(),
      });
      void queryClient.invalidateQueries({ queryKey: orpc.moderation.key() });
    },
  });

  const publish = () =>
    decide.mutate({
      target: { kind: "consultation", ref: consultation.id },
      status: "published",
    });

  const hide = () => {
    setTouched(true);
    if (reasonError) return;
    decide.mutate({
      target: { kind: "consultation", ref: consultation.id },
      status: "hidden",
      reason: reason.trim(),
    });
  };

  return (
    <section
      aria-labelledby="publication-title"
      className="flex flex-col gap-3"
    >
      <h2 id="publication-title" className="text-sm font-medium">
        {c("publicationTitle")}
      </h2>
      <div className="flex flex-col gap-1">
        <PublicationTag status={current} />
        {current === "published" ? null : (
          <p className="text-xs text-muted-foreground">
            {c(`publicationHelp.${current}`)}
          </p>
        )}
      </div>

      {hiding ? (
        <form
          noValidate
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!decide.isPending) hide();
          }}
        >
          <FormField
            htmlFor="hide-reason"
            label={t("note")}
            hint={c("hideReasonHint")}
            error={touched ? reasonError : null}
          >
            <Textarea
              id="hide-reason"
              value={reason}
              rows={4}
              className="min-h-24"
              required
              autoFocus
              aria-invalid={touched && reasonError !== null}
              aria-describedby={
                touched && reasonError
                  ? "hide-reason-error"
                  : "hide-reason-hint"
              }
              disabled={decide.isPending}
              onChange={(event) => setReason(event.target.value)}
              onBlur={() => setTouched(true)}
            />
          </FormField>
          <InlineError error={decide.error} />
          <div className="flex flex-col gap-2">
            <Button
              type="submit"
              variant="destructive"
              disabled={reasonError !== null || decide.isPending}
            >
              {c("hideConfirm")}
            </Button>
            <Button
              variant="ghost"
              disabled={decide.isPending}
              onClick={() => {
                setHiding(false);
                setReason("");
                setTouched(false);
              }}
            >
              {common("cancel")}
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-2 [&>:not(button)]:basis-full">
          <InlineError error={decide.error} />
          {current === "published" ? null : (
            <Button disabled={decide.isPending} onClick={publish}>
              {c("publish")}
            </Button>
          )}
          {current === "hidden" ? null : (
            <Button
              variant="outline"
              disabled={decide.isPending}
              onClick={() => setHiding(true)}
            >
              {c("hide")}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
