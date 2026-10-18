"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { Stamp } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/auth-context";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Placeholder } from "@/components/ui/loading";
import { Link } from "@/i18n/navigation";
import { client } from "@/lib/orpc";

/** A small, stable tilt per stamp, so the page looks stamped by hand. */
function tilt(id: string): number {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return (Math.abs(hash) % 13) - 6;
}

/**
 * The tourist passport: one stamp per place visited, private to its owner.
 * Each stamp is drawn like the real thing (a dashed ring, the municipality
 * in the mono face, the date) and carries the place's colour.
 */
export function PassportBook() {
  const t = useTranslations("passport");
  const format = useFormatter();
  const { isSignedIn, isLoading } = useAuth();
  const stamps = useInfiniteQuery({
    queryKey: ["passport", "list"],
    enabled: isSignedIn,
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      client.passport.list({ offset: pageParam, limit: 24 }),
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((sum, page) => sum + page.items.length, 0);
      return loaded < last.total ? loaded : undefined;
    },
  });

  if (isLoading || (isSignedIn && stamps.isPending))
    return <Placeholder className="h-96" />;
  if (!isSignedIn) {
    return (
      <EmptyState
        icon={Stamp}
        title={t("signedOutTitle")}
        body={t("signedOutBody")}
        action={
          <ButtonLink href="/entrar?callbackUrl=%2Fpasaporte" variant="primary">
            {t("signIn")}
          </ButtonLink>
        }
      />
    );
  }

  const items = stamps.data?.pages.flatMap((page) => page.items) ?? [];
  const total = stamps.data?.pages[0]?.total ?? 0;

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Stamp}
        title={t("empty")}
        body={t("emptyHint")}
        action={
          <ButtonLink href="/explorar" variant="primary">
            {t("explore")}
          </ButtonLink>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <p className="flex items-baseline gap-3">
        <span className="font-mono text-[56px] leading-none tracking-[-0.03em] text-ink tabular">
          {total}
        </span>
        <span className="t-body text-ink-2">
          {t("count", { count: total })}
        </span>
      </p>
      <ul className="stagger grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((stamp) => {
          const color = stamp.place?.categoryColor ?? "var(--ink-3)";
          return (
            <li
              key={stamp.id}
              className="flex flex-col items-center rounded-card bg-card px-4 pt-6 pb-5 text-center shadow-ring"
            >
              <div
                aria-hidden
                className="flex size-28 flex-col items-center justify-center rounded-full border-2 border-dashed"
                style={{
                  borderColor: color,
                  color,
                  transform: `rotate(${tilt(stamp.id)}deg)`,
                }}
              >
                <span className="t-label max-w-20 leading-tight">
                  {stamp.place?.municipalityName ?? t("withdrawn")}
                </span>
                <span className="mt-1.5 h-px w-12 bg-current opacity-40" />
                <span className="mt-1.5 font-mono text-[12px] tabular">
                  {format.dateTime(new Date(stamp.stampedAt), {
                    day: "2-digit",
                    month: "2-digit",
                    year: "2-digit",
                  })}
                </span>
              </div>
              {stamp.place ? (
                <Link
                  href={`/mapa?lugar=${stamp.place.slug}`}
                  className="mt-4 text-[15px] leading-snug font-medium text-ink hover:underline"
                >
                  {stamp.place.name}
                </Link>
              ) : (
                <span className="mt-4 text-[15px] text-ink-3">
                  {t("withdrawnPlace")}
                </span>
              )}
              <span className="t-small mt-0.5 text-ink-3">
                {stamp.place?.categoryName}
              </span>
            </li>
          );
        })}
      </ul>
      {stamps.hasNextPage ? (
        <Button
          className="self-center"
          onClick={() => void stamps.fetchNextPage()}
        >
          {t("more")}
        </Button>
      ) : null}
    </div>
  );
}
