"use client";

import { useQuery } from "@tanstack/react-query";
import {
  CloudOff,
  Flag,
  ImageIcon,
  Inbox,
  MapPin,
  MessagesSquare,
  Store,
  TrafficCone,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/auth-context";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Placeholder } from "@/components/ui/loading";
import { Tag } from "@/components/ui/tag";
import { useOfflineQueue } from "@/hooks/use-offline-queue";
import { useSignInHref } from "@/hooks/use-sign-in-href";
import { Link } from "@/i18n/navigation";
import { type client, orpc } from "@/lib/orpc";

type Item = Awaited<ReturnType<typeof client.places.contributions>>[number];

const ICONS = {
  place: MapPin,
  report: Flag,
  photo: ImageIcon,
  traffic: TrafficCone,
  consultation: MessagesSquare,
  claim: Store,
} as const;

const TONE: Partial<
  Record<
    Item["status"],
    "neutral" | "warning" | "success" | "danger" | "accent"
  >
> = {
  pending: "warning",
  in_review: "warning",
  open: "warning",
  published: "success",
  approved: "success",
  resolved: "success",
  active: "accent",
  answered: "accent",
  cleared: "success",
  rejected: "danger",
  dismissed: "neutral",
  removed: "danger",
  expired: "neutral",
  archived: "neutral",
  draft: "neutral",
};

/**
 * Everything the person has put into the platform and what became of it,
 * newest first, grouped by month. A refusal shows the municipality's note,
 * because "rejected" with no reason is a dead end.
 */
export function ContributionList() {
  const t = useTranslations("contributions");
  const format = useFormatter();
  const { isSignedIn, isLoading } = useAuth();
  const signInHref = useSignInHref();
  const queue = useOfflineQueue();
  const list = useQuery({
    ...orpc.places.contributions.queryOptions(),
    enabled: isSignedIn,
  });

  if (isLoading) return <Placeholder className="h-72" />;
  if (!isSignedIn) {
    return (
      <EmptyState
        icon={Inbox}
        title={t("signedOutTitle")}
        body={t("signedOutBody")}
        action={
          <ButtonLink href={signInHref as "/entrar"} variant="primary">
            {t("signIn")}
          </ButtonLink>
        }
      />
    );
  }

  const items = list.data ?? [];
  const groups = new Map<string, Item[]>();
  for (const item of items) {
    const key = format.dateTime(new Date(item.createdAt), {
      month: "long",
      year: "numeric",
    });
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  return (
    <div className="flex flex-col gap-8">
      {queue.pending > 0 ? (
        <Link
          href="/pendientes"
          className="flex items-center gap-4 rounded-card bg-[color-mix(in_srgb,var(--warning)_12%,transparent)] px-5 py-4"
        >
          <CloudOff
            strokeWidth={1.5}
            className="size-5 shrink-0 text-[color-mix(in_srgb,var(--warning)_75%,var(--ink))]"
          />
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-medium text-ink">
              {t("queued", { count: queue.pending })}
            </span>
            <span className="t-small block text-ink-2">{t("queuedHint")}</span>
          </span>
        </Link>
      ) : null}

      {list.isPending ? (
        <Placeholder className="h-72" />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={t("empty")}
          body={t("emptyHint")}
          action={
            <ButtonLink href="/mapa" variant="primary">
              {t("openMap")}
            </ButtonLink>
          }
        />
      ) : (
        [...groups.entries()].map(([month, entries]) => (
          <section key={month}>
            <h2 className="t-label mb-3 text-ink-3">{month}</h2>
            <ul className="stagger divide-y divide-line/60 overflow-hidden rounded-card bg-card shadow-ring">
              {entries.map((item) => {
                const Icon = ICONS[item.kind];
                const body = (
                  <>
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-paper-2 text-ink-2">
                      <Icon strokeWidth={1.5} className="size-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] text-ink">
                        {item.name}
                      </span>
                      <span className="t-small block text-ink-3">
                        {t(`kinds.${item.kind}`)} ·{" "}
                        {format.dateTime(new Date(item.createdAt), "short")}
                      </span>
                      {item.note ? (
                        <span className="t-small mt-1 block text-ink-2">
                          {t("note", { note: item.note })}
                        </span>
                      ) : null}
                    </span>
                    <Tag tone={TONE[item.status] ?? "neutral"}>
                      {t(`statuses.${item.status}`)}
                    </Tag>
                  </>
                );
                return (
                  <li key={`${item.kind}-${item.id}`}>
                    {item.href ? (
                      <Link
                        href={item.href as "/mapa"}
                        className="flex items-center gap-3 px-4 py-3.5 hover:bg-paper-2"
                      >
                        {body}
                      </Link>
                    ) : (
                      <div className="flex items-center gap-3 px-4 py-3.5">
                        {body}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
