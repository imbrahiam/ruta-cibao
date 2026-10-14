"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Landmark,
  MapPin,
  MessagesSquare,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/auth-context";
import { StatusBadge } from "@/components/consultations/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useRealtime } from "@/hooks/use-realtime";
import { Link } from "@/i18n/navigation";
import { categoryIcon } from "@/lib/map/category-icons";
import { newIdempotencyKey } from "@/lib/offline/queue";
import { client, orpc } from "@/lib/orpc";

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
      <p
        className="flex items-center justify-center gap-2 py-16 text-muted-foreground text-sm"
        role="status"
      >
        <Spinner className="size-4" /> {t("loading")}
      </p>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="flex flex-col items-start gap-4">
        <p role="alert" className="text-muted-foreground text-sm">
          {t("notFound")}
        </p>
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href="/consultas" />}
        >
          <ArrowLeft className="size-4" aria-hidden />
          {t("back")}
        </Button>
      </div>
    );
  }

  const item = query.data;
  const Icon = categoryIcon(item.categoryIcon);
  const isCitizen = viewer?.kind === "citizen";
  const isOfficial = isCitizen && viewer.staffRole !== "none";
  const closed = item.status === "resolved" || item.status === "rejected";

  return (
    <div className="flex flex-col gap-8">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 self-start"
        nativeButton={false}
        render={<Link href="/consultas" />}
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t("back")}
      </Button>

      <article className="flex flex-col gap-5">
        <header className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <span
              className="flex size-11 shrink-0 items-center justify-center rounded-full"
              style={{
                backgroundColor: `${item.categoryColor}1f`,
                color: item.categoryColor,
              }}
            >
              <Icon className="size-5" />
            </span>
            <div className="min-w-0 space-y-1">
              <h1 className="text-pretty font-semibold text-xl leading-snug tracking-tight sm:text-2xl">
                {item.title}
              </h1>
              <p className="text-muted-foreground text-sm">
                {item.openedBy
                  ? t("openedBy", { name: item.openedBy })
                  : t("openedByAnon")}
                {" · "}
                {format.dateTime(new Date(item.createdAt), "short")}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={item.status} />
            <Badge variant="secondary">{item.categoryName}</Badge>
            <Badge variant="outline">{item.municipalityName}</Badge>
            {item.location && (
              <Badge variant="outline">
                <MapPin className="size-3.5" aria-hidden />
                <span className="font-mono text-xs">
                  <Link href={`/mapa?caso=${item.slug}`}>
                    {item.location.lat.toFixed(4)},{" "}
                    {item.location.lng.toFixed(4)}
                  </Link>
                </span>
              </Badge>
            )}
          </div>
        </header>

        <p className="whitespace-pre-line text-pretty leading-relaxed">
          {item.body}
        </p>

        <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-muted/35 p-4">
          <p className="flex min-w-0 flex-1 items-center gap-2 text-sm">
            <Users
              className="size-4 shrink-0 text-muted-foreground"
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
            <p className="text-muted-foreground text-xs">
              {t("support.closed")}
            </p>
          ) : !isCitizen ? (
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href="/verificar" />}
            >
              <ShieldCheck className="size-4" aria-hidden />
              {t("support.verify")}
            </Button>
          ) : null}
        </div>
      </article>

      <Separator />

      <section className="flex flex-col gap-4">
        <h2 className="font-semibold text-lg tracking-tight">
          {t("responses.title")}
        </h2>

        {item.responses.length === 0 ? (
          <div className="rounded-2xl border bg-muted/30 p-6 text-center">
            <MessagesSquare
              className="mx-auto size-6 text-muted-foreground"
              aria-hidden
            />
            <p className="mt-3 font-medium text-sm">{t("responses.empty")}</p>
            <p className="mt-1 text-muted-foreground text-sm leading-relaxed">
              {t("responses.emptyHint")}
            </p>
          </div>
        ) : (
          <ol className="flex flex-col gap-4">
            {item.responses.map((response) => (
              <li
                key={response.id}
                className="rounded-2xl border bg-card p-5 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Landmark className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-sm">
                        {response.author
                          ? t("responses.author", { name: response.author })
                          : t("responses.byOffice")}
                      </p>
                      <span className="text-muted-foreground text-xs">
                        {format.dateTime(new Date(response.createdAt), "short")}
                      </span>
                      <StatusBadge status={response.statusAfter} />
                    </div>
                    <p className="whitespace-pre-line text-pretty text-sm leading-relaxed">
                      {response.body}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}

        {isOfficial && (
          <form
            className="flex flex-col gap-4 rounded-2xl border bg-card p-5"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              reply.mutate(String(form.get("body") ?? ""));
              event.currentTarget.reset();
            }}
          >
            <h3 className="font-medium">{t("reply.title")}</h3>

            <div className="space-y-2">
              <Label htmlFor="reply-body">{t("reply.body")}</Label>
              <Textarea
                id="reply-body"
                name="body"
                rows={4}
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
                className="w-full"
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
              <p className="text-muted-foreground text-xs leading-relaxed">
                {t("reply.statusHint")}
              </p>
            </div>

            <Button type="submit" disabled={reply.isPending}>
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
