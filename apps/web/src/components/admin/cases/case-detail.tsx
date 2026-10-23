"use client";

import type { ApiInputs, ApiOutputs } from "@ruta/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, MapPin, MessagesSquare } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useFormatter, useTranslations } from "use-intl";
import { ErrorPanel, InlineError } from "@/components/admin/error-panel";
import { useOutcome } from "@/components/admin/outcome";
import { useStaffMutation } from "@/components/admin/use-staff-mutation";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Textarea } from "@/components/ui/field";
import { Placeholder } from "@/components/ui/loading";
import { api, orpc } from "@/lib/web/api";
import { cx } from "@/lib/web/cx";
import { failureKind } from "@/lib/web/errors";
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

/** One case, its official replies and the two things staff can do to it. */
export function CaseDetail({ slug }: { slug: string }) {
  const t = useTranslations("admin");
  const c = useTranslations("admin.cases");
  const consultations = useTranslations("consultations");
  const format = useFormatter();
  const query = useQuery(
    orpc.consultations.detail.queryOptions({ input: { slug } }),
  );

  const back = (
    <Link
      href="/admin/consultations"
      className="t-small -ml-1 inline-flex min-h-11 items-center gap-1.5 self-start rounded-full px-1 text-ink-2 hover:text-ink"
    >
      <ArrowLeft aria-hidden className="size-4" />
      {c("back")}
    </Link>
  );

  // A background refetch that fails (a case hidden a moment ago, a dropped
  // connection) must not blank a case the reviewer is reading: data wins.
  if (!query.data) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        {query.isPending ? (
          <div role="status" aria-busy="true" className="flex flex-col gap-3">
            <span className="sr-only">{t("loading")}</span>
            <Placeholder className="h-40" />
            <Placeholder className="h-56" />
          </div>
        ) : failureKind(query.error) === "not_found" ? (
          <EmptyState icon={MessagesSquare} title={consultations("missing")} />
        ) : (
          <ErrorPanel error={query.error} onRetry={() => query.refetch()} />
        )}
      </div>
    );
  }

  const item = query.data;
  const when = (iso: string) =>
    `${format.dateTime(new Date(iso), "long")} · ${format.dateTime(new Date(iso), "time")}`;

  return (
    <article className="flex flex-col gap-6" aria-busy={query.isFetching}>
      {back}

      <header className="flex flex-col gap-3">
        <p className="t-label text-ink-3">{item.municipalityName}</p>
        <h1 className="t-h2">{item.title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <CaseStatusTag status={item.status} />
          <PublicationTag status={item.publicationStatus} />
        </div>
        <dl className="t-small grid gap-x-6 gap-y-1 text-ink-2 sm:grid-cols-2 lg:flex lg:flex-wrap">
          <Meta label={t("municipality")} value={item.municipalityName} />
          <Meta label={c("category")} value={item.categoryName} />
          <Meta
            label={c("colDate")}
            value={c("openedOn", {
              date: format.dateTime(new Date(item.createdAt), "long"),
            })}
          />
          {item.openedBy ? (
            <Meta
              label=""
              value={consultations("openedBy", { name: item.openedBy })}
            />
          ) : null}
          <Meta
            label={c("colSupport")}
            value={consultations("supports", { count: item.supportCount })}
          />
        </dl>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          <section className="flex flex-col gap-3 rounded-card bg-card p-5 shadow-ring">
            <p className="t-body whitespace-pre-line text-ink">{item.body}</p>
            {item.location ? (
              <p className="t-small flex flex-wrap items-center gap-x-3 gap-y-1 text-ink-2">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin aria-hidden className="size-4" />
                  {c("location")}: {item.location.lat.toFixed(5)},{" "}
                  {item.location.lng.toFixed(5)}
                </span>
                <a
                  href={`https://www.openstreetmap.org/?mlat=${item.location.lat}&mlon=${item.location.lng}#map=17/${item.location.lat}/${item.location.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center text-accent underline underline-offset-2 md:min-h-0"
                >
                  {c("viewOnMap")}
                </a>
              </p>
            ) : null}
          </section>

          <section
            aria-labelledby="timeline-title"
            className="flex flex-col gap-3"
          >
            <h2 id="timeline-title" className="t-h3">
              {consultations("timeline")}
            </h2>
            {item.responses.length === 0 ? (
              <p className="t-body rounded-card bg-paper-2 p-4 text-ink-2">
                {c("noResponses")}
              </p>
            ) : (
              <ol className="flex flex-col gap-3">
                {item.responses.map((response) => (
                  <li
                    key={response.id}
                    className="flex flex-col gap-2 rounded-card bg-card p-4 shadow-ring"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="t-small text-ink-2">
                        {c("repliedBy", {
                          name: response.author ?? c("officialAnonymous"),
                          date: when(response.createdAt),
                        })}
                      </p>
                      <span className="flex items-center gap-2">
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
                    <p className="t-body whitespace-pre-line text-ink">
                      {response.body}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <ReplyForm consultation={item} />
        </div>

        <PublicationControl consultation={item} />
      </div>
    </article>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-1.5">
      {label ? <dt className="sr-only">{label}</dt> : null}
      <dd>{value}</dd>
    </div>
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

  const reply = useStaffMutation<ReplyInput, { status: "ok" }>(
    (input) => api.consultations.respond(input),
    {
      onSuccess: async () => {
        setBody("");
        setStatusAfter("");
        setBodyTouched(false);
        announce(c("replied"));
        await queryClient.invalidateQueries({
          queryKey: orpc.consultations.key(),
        });
      },
    },
  );

  const refetchOnConflict = (error: unknown) => {
    if (failureKind(error) === "conflict") {
      void queryClient.invalidateQueries({
        queryKey: orpc.consultations.key(),
      });
    }
  };

  const submit = () => {
    setBodyTouched(true);
    if (!valid) return;
    reply.mutate(
      { consultationId: consultation.id, body: body.trim(), statusAfter },
      { onError: refetchOnConflict },
    );
  };

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (!reply.isPending) submit();
      }}
      className="flex flex-col gap-5 rounded-card bg-card p-5 shadow-ring"
    >
      <h2 className="t-h3">{c("replyTitle")}</h2>

      <Field
        htmlFor="reply-body"
        label={c("replyBody")}
        hint={c("replyHint", { count: length })}
        error={bodyTouched ? bodyError : null}
      >
        <Textarea
          id="reply-body"
          value={body}
          rows={6}
          required
          aria-invalid={bodyTouched && bodyError !== null}
          aria-describedby={
            bodyTouched && bodyError ? "reply-body-error" : "reply-body-hint"
          }
          disabled={reply.isPending}
          onChange={(event) => setBody(event.target.value)}
          onBlur={() => setBodyTouched(true)}
        />
      </Field>

      <fieldset className="flex flex-col gap-2" disabled={reply.isPending}>
        <legend className="text-[14px] font-medium text-ink">
          {c("statusAfter")}
        </legend>
        <p className="t-small text-ink-3">{c("statusAfterHint")}</p>
        <div className="mt-1 grid gap-2 sm:grid-cols-2">
          {REPLY_STATUSES.map((value) => {
            const selected = statusAfter === value;
            return (
              <label
                key={value}
                className={cx(
                  "flex min-h-11 cursor-pointer items-start gap-3 rounded-input p-3 shadow-ring has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
                  selected ? "bg-accent-soft" : "bg-card hover:bg-paper-2",
                )}
              >
                <input
                  type="radio"
                  name="status-after"
                  value={value}
                  checked={selected}
                  onChange={() => setStatusAfter(value)}
                  className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]"
                />
                <span className="flex flex-col">
                  <span className="text-[15px] font-medium text-ink">
                    {consultations(`statusLabel.${value}`)}
                  </span>
                  <span className="t-small text-ink-2">
                    {c(`statusHelp.${value}`)}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
        {bodyTouched && statusAfter === "" ? (
          <p role="alert" className="text-[14px] text-danger-ink">
            {c("errStatus")}
          </p>
        ) : null}
      </fieldset>

      <InlineError error={reply.error} />

      <div>
        <Button
          type="submit"
          variant="accent"
          size="lg"
          block
          className="md:w-auto"
          disabled={!valid || reply.isPending}
        >
          {reply.isPending ? c("sending") : t("respond")}
        </Button>
      </div>
    </form>
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

  const decide = useStaffMutation<
    PublicationInput,
    { status: "published" | "hidden" }
  >((input) => api.moderation.decidePublication(input), {
    onSuccess: async (result) => {
      announce(c("publicationDone"));
      setHiding(false);
      setReason("");
      setTouched(false);
      // Show the new state at once: once a case is hidden the detail read
      // may no longer be open to staff, and a refetch must not blank it.
      queryClient.setQueryData(
        orpc.consultations.detail.queryOptions({
          input: { slug: consultation.slug },
        }).queryKey,
        (old: Detail | undefined) =>
          old ? { ...old, publicationStatus: result.status } : old,
      );
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: orpc.consultations.browse.key(),
        }),
        queryClient.invalidateQueries({ queryKey: orpc.moderation.key() }),
      ]);
    },
  });

  const onError = (error: unknown) => {
    if (failureKind(error) === "conflict") {
      void queryClient.invalidateQueries({
        queryKey: orpc.consultations.key(),
      });
    }
  };

  const publish = () =>
    decide.mutate(
      {
        target: { kind: "consultation", ref: consultation.id },
        status: "published",
      },
      { onError },
    );

  const hide = () => {
    setTouched(true);
    if (reasonError) return;
    decide.mutate(
      {
        target: { kind: "consultation", ref: consultation.id },
        status: "hidden",
        reason: reason.trim(),
      },
      { onError },
    );
  };

  return (
    <aside
      aria-labelledby="publication-title"
      className="flex flex-col gap-3 rounded-card bg-card p-5 shadow-ring"
    >
      <h2 id="publication-title" className="t-h3">
        {c("publicationTitle")}
      </h2>
      <div className="flex items-center gap-2">
        <PublicationTag status={current} />
      </div>
      <p className="t-small text-ink-2">{c(`publicationHelp.${current}`)}</p>

      {hiding ? (
        <form
          noValidate
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!decide.isPending) hide();
          }}
        >
          <Field
            htmlFor="hide-reason"
            label={t("note")}
            hint={c("hideReasonHint")}
            error={touched ? reasonError : null}
          >
            <Textarea
              id="hide-reason"
              value={reason}
              rows={4}
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
          </Field>
          <InlineError error={decide.error} />
          <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
            <Button
              type="submit"
              variant="danger"
              size="lg"
              block
              disabled={reasonError !== null || decide.isPending}
            >
              {c("hideConfirm")}
            </Button>
            <Button
              size="lg"
              block
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
        <div className="flex flex-col gap-2">
          <InlineError error={decide.error} />
          {current === "published" ? null : (
            <Button
              variant="accent"
              size="lg"
              block
              disabled={decide.isPending}
              onClick={publish}
            >
              {c("publish")}
            </Button>
          )}
          {current === "hidden" ? null : (
            <Button
              variant="danger"
              size="lg"
              block
              disabled={decide.isPending}
              onClick={() => setHiding(true)}
            >
              {c("hide")}
            </Button>
          )}
        </div>
      )}
    </aside>
  );
}
