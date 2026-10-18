"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Landmark, ThumbsUp } from "lucide-react";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { useState } from "react";
import { useAuth } from "@/components/auth/auth-context";
import { CategoryIcon } from "@/components/places/category-icon";
import { RouteMap } from "@/components/routes/route-map";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/field";
import { Placeholder } from "@/components/ui/loading";
import { toast } from "@/components/ui/toast";
import { useRealtime } from "@/hooks/use-realtime";
import { useSignInHref } from "@/hooks/use-sign-in-href";
import { Link, useRouter } from "@/i18n/navigation";
import { cx } from "@/lib/cx";
import { newIdempotencyKey } from "@/lib/offline/submit";
import { orpc } from "@/lib/orpc";
import { StatusTag } from "./status-tag";

/**
 * One case: what was asked, how many neighbours stand behind it, and every
 * answer the ayuntamiento gave, in order. Staff answer from the same page.
 */
export function ConsultationDetail({ slug }: { slug: string }) {
  const t = useTranslations("consultations");
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const { isSignedIn, isCitizen, isStaff } = useAuth();
  const signInHref = useSignInHref();
  const router = useRouter();
  const queryClient = useQueryClient();
  const key = orpc.consultations.detail.queryOptions({
    input: { slug },
  }).queryKey;
  const query = useQuery(
    orpc.consultations.detail.queryOptions({ input: { slug } }),
  );

  useRealtime({
    channels: ["consultations"],
    onEvent: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  const support = useMutation(
    orpc.consultations.support.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: key });
        queryClient.invalidateQueries({ queryKey: ["consultations"] });
      },
      onError: () => toast.error({ title: t("supportFailed") }),
    }),
  );

  if (query.isPending) return <Placeholder className="h-96" />;
  if (query.isError || !query.data) {
    return (
      <p className="t-body rounded-card bg-paper-2 p-6 text-ink-2">
        {t("missing")}
      </p>
    );
  }
  const item = query.data;

  return (
    <article className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-12">
      <div className="min-w-0">
        <Link
          href="/consultas"
          className="t-small inline-flex items-center gap-1.5 text-ink-2 hover:text-ink"
        >
          <ArrowLeft strokeWidth={1.5} className="size-4" />
          {t("back")}
        </Link>
        <div className="mt-6 flex flex-wrap items-center gap-2 animate-rise">
          <StatusTag status={item.status} />
          <span className="t-small inline-flex items-center gap-1.5 text-ink-3">
            <span style={{ color: item.categoryColor }} className="flex">
              <CategoryIcon icon={item.categoryIcon} className="size-4" />
            </span>
            {item.categoryName} · {item.municipalityName}
          </span>
        </div>
        <h1 className="t-h2 mt-3 text-ink animate-rise">{item.title}</h1>
        <p className="t-small mt-3 text-ink-3">
          {t("openedBy", {
            name: item.openedBy ?? t("someone"),
            when: format.relativeTime(new Date(item.createdAt), now),
          })}
        </p>
        <p className="t-body-lg mt-6 whitespace-pre-line text-ink">
          {item.body}
        </p>

        <section className="mt-10">
          <h2 className="t-label text-ink-3">{t("timeline")}</h2>
          {item.responses.length === 0 ? (
            <p className="t-body mt-4 rounded-card bg-paper-2 px-5 py-4 text-ink-2">
              {t("noResponses")}
            </p>
          ) : (
            <ol className="mt-4 flex flex-col">
              {item.responses.map((response, index) => (
                <li key={response.id} className="relative flex gap-4 pb-6">
                  {index < item.responses.length - 1 ? (
                    <span
                      aria-hidden
                      className="absolute top-11 bottom-0 left-[19px] w-px bg-line"
                    />
                  ) : null}
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                    <Landmark strokeWidth={1.5} className="size-[18px]" />
                  </span>
                  <div className="min-w-0 flex-1 rounded-card bg-card p-4 shadow-ring">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[15px] font-medium text-ink">
                        {response.author ?? t("ayuntamiento")}
                      </span>
                      <StatusTag status={response.statusAfter} />
                    </div>
                    <p className="t-body mt-2 whitespace-pre-line text-ink-2">
                      {response.body}
                    </p>
                    <p className="t-small mt-2 text-ink-3">
                      {format.dateTime(new Date(response.createdAt), "long")}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        {isStaff ? (
          <RespondForm
            consultationId={item.id}
            onDone={() => queryClient.invalidateQueries({ queryKey: key })}
          />
        ) : null}
      </div>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-panel bg-card p-5 shadow-ring">
          <p className="font-mono text-[36px] leading-none tracking-[-0.02em] text-ink tabular">
            {item.supportCount}
          </p>
          <p className="t-small mt-1 text-ink-2">
            {t("supportersLong", { count: item.supportCount })}
          </p>
          {item.isMine ? (
            <p className="t-small mt-4 text-ink-3">{t("yours")}</p>
          ) : (
            <Button
              block
              className="mt-4"
              variant={item.supported ? "primary" : "accent"}
              aria-pressed={item.supported}
              disabled={support.isPending}
              onClick={() => {
                if (!isSignedIn) router.push(signInHref as "/entrar");
                else if (!isCitizen) router.push("/verificar?next=/consultas");
                else
                  support.mutate({
                    consultationId: item.id,
                    supported: !item.supported,
                  });
              }}
            >
              <ThumbsUp
                strokeWidth={1.75}
                className={cx(item.supported && "fill-current")}
              />
              {item.supported ? t("supported") : t("support")}
            </Button>
          )}
          {!isCitizen && !item.isMine ? (
            <p className="t-small mt-3 text-ink-3">{t("supportHint")}</p>
          ) : null}
        </div>
        {item.location ? (
          <div className="overflow-hidden rounded-panel shadow-ring">
            <RouteMap
              path={[item.location]}
              label={t("mapLabel")}
              className="relative h-56"
            />
          </div>
        ) : null}
        <ButtonLink href="/consultas?abrir=1" variant="secondary">
          {t("open")}
        </ButtonLink>
      </aside>
    </article>
  );
}

function RespondForm({
  consultationId,
  onDone,
}: {
  consultationId: string;
  onDone: () => void;
}) {
  const t = useTranslations("consultations.respond");
  const tStatus = useTranslations("consultations.statusLabels");
  const [body, setBody] = useState("");
  const [statusAfter, setStatusAfter] = useState<
    "in_review" | "answered" | "resolved" | "rejected"
  >("answered");
  const respond = useMutation(
    orpc.consultations.respond.mutationOptions({
      onSuccess: () => {
        setBody("");
        toast.success({ title: t("sent") });
        onDone();
      },
      onError: () => toast.error({ title: t("failed") }),
    }),
  );
  return (
    <section className="mt-4 rounded-panel bg-paper-2 p-5">
      <h2 className="t-h3">{t("title")}</h2>
      <p className="t-small mt-1 text-ink-2">{t("hint")}</p>
      <div className="mt-4 flex flex-col gap-4">
        <Field htmlFor="respond-body" label={t("body")}>
          <Textarea
            id="respond-body"
            value={body}
            maxLength={2000}
            onChange={(event) => setBody(event.target.value)}
          />
        </Field>
        <Field htmlFor="respond-status" label={t("status")}>
          <Select
            id="respond-status"
            value={statusAfter}
            onChange={(event) =>
              setStatusAfter(event.target.value as typeof statusAfter)
            }
          >
            {(["in_review", "answered", "resolved", "rejected"] as const).map(
              (value) => (
                <option key={value} value={value}>
                  {tStatus(value)}
                </option>
              ),
            )}
          </Select>
        </Field>
        <Button
          variant="primary"
          className="self-start"
          disabled={body.trim().length < 10 || respond.isPending}
          onClick={() =>
            respond.mutate({
              requestId: newIdempotencyKey(),
              consultationId,
              body: body.trim(),
              statusAfter,
            })
          }
        >
          {respond.isPending ? t("sending") : t("submit")}
        </Button>
      </div>
    </section>
  );
}
