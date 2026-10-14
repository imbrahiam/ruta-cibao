"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Map as MapIcon,
  MessagesSquare,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/auth-context";
import { StatusBadge } from "@/components/consultations/status-badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui-patterns/empty-state";
import { RowPictogram } from "@/components/ui-patterns/list-row";
import { StatusGlyph, statusTone } from "@/components/ui-patterns/status-badge";
import { useRealtime } from "@/hooks/use-realtime";
import { Link } from "@/i18n/navigation";
import { categoryIcon } from "@/lib/map/category-icons";
import { newIdempotencyKey } from "@/lib/offline/queue";
import { client, orpc } from "@/lib/orpc";
import { cn } from "@/lib/utils";

/**
 * One case, its support, and everything the ayuntamiento has said about it.
 *
 * The replies read as a conversation in order, oldest first, because that is
 * what a case is: "lo estamos viendo" in March and "listo" in May are two
 * things a resident should be able to point at, not one field that overwrote
 * the other.
 *
 * Officials get the reply form on the same page rather than in a separate desk.
 * A reply written next to the case it answers is a better reply, and the
 * alternative — a moderation queue that strips the context — is how a
 * municipality ends up sending "recibido" to everybody.
 */
type ReplyStatus = "in_review" | "answered" | "resolved" | "rejected";

const REPLY_STATUSES: ReplyStatus[] = [
  "in_review",
  "answered",
  "resolved",
  "rejected",
];

export function ConsultationDetail({ slug }: { slug: string }) {
  const t = useTranslations("consultations");
  const format = useFormatter();
  const queryClient = useQueryClient();
  const { viewer } = useAuth();

  const query = useQuery(
    orpc.consultations.detail.queryOptions({ input: { slug } }),
  );

  // An official answering while a resident has the page open should reach them
  // without a refresh — this is the screen somebody sits on waiting.
  useRealtime({
    channels: ["consultations"],
    onEvent: () => {
      void queryClient.invalidateQueries({
        queryKey: orpc.consultations.detail.key(),
      });
    },
  });

  const [replyStatus, setReplyStatus] = useState<ReplyStatus>("answered");

  const support = useMutation({
    mutationFn: (supported: boolean) =>
      client.consultations.support({
        consultationId: query.data?.id ?? "",
        supported,
      }),
    onSuccess: async (result) => {
      toast.success(
        result.supported ? t("support.added") : t("support.removed"),
      );
      await queryClient.invalidateQueries({
        queryKey: orpc.consultations.detail.key(),
      });
    },
    onError: () => toast.error(t("support.failed")),
  });

  const reply = useMutation({
    mutationFn: (body: string) =>
      client.consultations.respond({
        requestId: newIdempotencyKey(),
        consultationId: query.data?.id ?? "",
        body,
        statusAfter: replyStatus,
      }),
    onSuccess: async () => {
      toast.success(t("reply.sent"));
      await queryClient.invalidateQueries({
        queryKey: orpc.consultations.detail.key(),
      });
    },
    onError: () => toast.error(t("reply.failed")),
  });

  if (query.isPending) {
    return (
      <div role="status" className="mx-auto max-w-3xl space-y-4">
        <span className="sr-only">{t("loading")}</span>
        <Skeleton aria-hidden className="h-11 w-40 rounded-full" />
        <Skeleton aria-hidden className="mt-6 h-8 w-4/5" />
        <Skeleton aria-hidden className="h-5 w-1/2" />
        <Skeleton aria-hidden className="mt-6 h-24 w-full rounded-2xl" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="mx-auto max-w-3xl">
        <EmptyState
          illustration="cases"
          title={t("notFound")}
          action={
            <Button
              variant="outline"
              className="rounded-full px-5"
              nativeButton={false}
              render={<Link href="/consultas" />}
            >
              <ArrowLeft className="size-4" aria-hidden />
              {t("back")}
            </Button>
          }
        />
      </div>
    );
  }

  const item = query.data;
  const isCitizen = viewer?.kind === "citizen";
  const isOfficial = isCitizen && viewer.staffRole !== "none";
  const closed = item.status === "resolved" || item.status === "rejected";

  /**
   * The case's history, from what the data actually records: the day it was
   * opened, then every official reply and the state it left the case in. No
   * invented steps — a case that nobody has answered has one entry, and says so.
   */
  const steps = [
    {
      id: "opened",
      status: "open" as const,
      date: item.createdAt,
      who: item.openedBy
        ? t("openedBy", { name: item.openedBy })
        : t("openedByAnon"),
      body: null as string | null,
    },
    ...item.responses.map((response) => ({
      id: response.id,
      status: response.statusAfter,
      date: response.createdAt,
      who: response.author
        ? t("responses.author", { name: response.author })
        : t("responses.byOffice"),
      body: response.body,
    })),
  ];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <Button
        variant="ghost"
        className="-ml-3 h-11 self-start rounded-full px-3 text-[15px]"
        nativeButton={false}
        render={<Link href="/consultas" />}
      >
        <ArrowLeft className="size-5" aria-hidden />
        {t("back")}
      </Button>

      <article className="flex flex-col gap-6">
        <header className="flex flex-col gap-4">
          <p className="flex items-center gap-3 text-[15px] text-muted-foreground">
            <RowPictogram
              icon={categoryIcon(item.categoryIcon)}
              color={item.categoryColor}
              className="size-10 [&_svg]:size-5"
            />
            <span>
              {item.categoryName} · {item.municipalityName}
            </span>
          </p>
          <h1 className="text-pretty font-semibold text-[1.625rem] leading-tight tracking-[-0.02em] sm:text-[2rem]">
            {item.title}
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <StatusBadge status={item.status} />
            <span className="text-[15px] text-muted-foreground">
              {format.dateTime(new Date(item.createdAt), {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
          </div>
        </header>

        <p className="whitespace-pre-line text-pretty text-[17px] leading-relaxed">
          {item.body}
        </p>

        {item.location && (
          <Button
            variant="outline"
            className="h-11 self-start rounded-full px-5 text-[15px]"
            nativeButton={false}
            render={<Link href={`/mapa?caso=${item.slug}`} />}
          >
            <MapIcon className="size-5" aria-hidden />
            {t("viewOnMap")}
          </Button>
        )}

        <div className="flex flex-col items-start gap-3 rounded-2xl bg-secondary p-4 sm:flex-row sm:items-center sm:p-5">
          <p className="flex min-w-0 flex-1 items-center gap-2.5 font-medium text-[15px]">
            <Users
              className="size-5 shrink-0 text-muted-foreground"
              aria-hidden
            />
            {t("support.count", { count: item.supportCount })}
          </p>

          {/* Support is the one thing on this page that needs a cédula, so the
              reason is shown where the button would be rather than as a
              disabled control somebody has to guess at. */}
          {isCitizen && !item.isMine && !closed ? (
            <Button
              variant={item.supported ? "default" : "outline"}
              className="h-11 rounded-full px-5"
              disabled={support.isPending}
              onClick={() => support.mutate(!item.supported)}
            >
              {support.isPending ? (
                <Spinner className="size-4" />
              ) : (
                <Users className="size-4" aria-hidden />
              )}
              {item.supported ? t("support.remove") : t("support.add")}
            </Button>
          ) : closed ? (
            <p className="text-muted-foreground text-sm">
              {t("support.closed")}
            </p>
          ) : !isCitizen ? (
            <Button
              variant="outline"
              className="h-11 rounded-full px-5"
              nativeButton={false}
              render={<Link href="/verificar" />}
            >
              <ShieldCheck className="size-4" aria-hidden />
              {t("support.verify")}
            </Button>
          ) : null}
        </div>
      </article>

      <section aria-labelledby="seguimiento" className="flex flex-col gap-5">
        <h2 id="seguimiento" className="section-title">
          {t("timeline")}
        </h2>

        {/* The badge, expanded: one stop per change of state, oldest first,
            joined by a line. The current stop is the last one and the only one
            in bold. Every stop says its state in a word next to its glyph. */}
        <ol className="flex flex-col">
          {steps.map((step, index) => {
            const tone = statusTone(step.status);
            const last = index === steps.length - 1;
            return (
              <li key={step.id} className="relative flex gap-4">
                <div className="flex w-7 shrink-0 flex-col items-center">
                  <span className="flex size-7 items-center justify-center rounded-full bg-background ring-1 ring-border">
                    <StatusGlyph tone={tone} className="size-5" />
                  </span>
                  {!last && (
                    <span aria-hidden className="w-0.5 flex-1 bg-primary/35" />
                  )}
                </div>
                <div className={cn("min-w-0 flex-1", last ? "pb-1" : "pb-7")}>
                  <p className="flex flex-wrap items-baseline gap-x-2 pt-0.5">
                    <span
                      className={cn(
                        "text-[17px] text-foreground",
                        last ? "font-bold" : "font-medium",
                      )}
                    >
                      {t(`statusLabel.${step.status}`)}
                    </span>
                    <time dateTime={step.date} className="meta-mono text-sm">
                      {format.dateTime(new Date(step.date), "short")}
                    </time>
                  </p>
                  <p className="mt-0.5 text-[15px] text-muted-foreground">
                    {step.who}
                  </p>
                  {step.body && (
                    <p className="mt-3 whitespace-pre-line text-pretty rounded-2xl bg-secondary p-4 text-[16px] text-foreground leading-relaxed">
                      {step.body}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        {item.responses.length === 0 && (
          <p className="flex items-center gap-2.5 rounded-2xl bg-secondary p-4 text-[15px]">
            <MessagesSquare
              className="size-5 shrink-0 text-muted-foreground"
              aria-hidden
            />
            {t("responses.empty")}
          </p>
        )}

        {isOfficial && (
          <form
            className="mt-2 flex flex-col gap-4 rounded-2xl bg-secondary p-5"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              reply.mutate(String(form.get("body") ?? ""));
              event.currentTarget.reset();
            }}
          >
            <h3 className="font-semibold text-lg">{t("reply.title")}</h3>

            <div className="space-y-2">
              <Label htmlFor="reply-body">{t("reply.body")}</Label>
              <Textarea
                id="reply-body"
                name="body"
                rows={4}
                className="bg-background"
                placeholder={t("reply.bodyPlaceholder")}
                minLength={10}
                maxLength={2000}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reply-status">{t("reply.status")}</Label>
              <NativeSelect
                id="reply-status"
                size="lg"
                className="w-full bg-background"
                value={replyStatus}
                onChange={(event) =>
                  setReplyStatus(event.target.value as ReplyStatus)
                }
              >
                {REPLY_STATUSES.map((status) => (
                  <NativeSelectOption key={status} value={status}>
                    {t(`statusLabel.${status}`)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {t("reply.statusHint")}
              </p>
            </div>

            <Button
              type="submit"
              className="h-11 self-start rounded-full px-6"
              disabled={reply.isPending}
            >
              {reply.isPending ? (
                <Spinner className="size-4" />
              ) : (
                <MessagesSquare className="size-4" aria-hidden />
              )}
              {reply.isPending ? t("reply.sending") : t("reply.submit")}
            </Button>
          </form>
        )}
      </section>
    </div>
  );
}
