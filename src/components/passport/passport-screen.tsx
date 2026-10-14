"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Compass, Stamp } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { useAuth } from "@/components/auth/auth-context";
import { ListSkeleton } from "@/components/shell/list-skeleton";
import { Button } from "@/components/ui/button";
import { MagicCard } from "@/components/ui/magic-card";
import { Link } from "@/i18n/navigation";
import { orpc } from "@/lib/orpc";

const PAGE_SIZE = 24;

export function PassportScreen() {
  const t = useTranslations("passport");
  const format = useFormatter();
  const { viewer, isLoading, isUnavailable } = useAuth();
  const [offset, setOffset] = useState(0);
  const signedIn = viewer !== undefined && viewer.kind !== "anonymous";
  const query = useQuery({
    ...orpc.passport.list.queryOptions({ input: { offset, limit: PAGE_SIZE } }),
    enabled: signedIn,
  });
  const loading = isLoading || (signedIn && query.isPending);
  const total = query.data?.total ?? 0;
  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-8">
        <p className="page-eyebrow mb-3">{t("eyebrow")}</p>
        <h1 className="page-title">{t("title")}</h1>
        <p className="page-lede mt-3 max-w-2xl">{t("intro")}</p>
      </header>
      <MagicCard
        className="mb-8 rounded-3xl"
        gradientColor="#e5eee7"
        gradientOpacity={0.35}
        gradientFrom="#a0bca8"
        gradientTo="#d6b47b"
      >
        <section className="flex items-center gap-5 p-6 sm:p-8">
          <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Stamp className="size-8" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="font-semibold text-lg">
              {loading ? t("loading") : t("count", { count: total })}
            </h2>
            <p className="mt-2 text-muted-foreground text-sm leading-relaxed">
              {t("privateHint")}
            </p>
          </div>
        </section>
      </MagicCard>
      {loading ? (
        <ListSkeleton label={t("loading")} />
      ) : isUnavailable || (signedIn && query.isError) ? (
        <div role="alert" className="surface-card p-6">
          <p>{t("error")}</p>
          <Button
            className="mt-4 rounded-full"
            onClick={() =>
              isUnavailable ? window.location.reload() : void query.refetch()
            }
          >
            {t("retry")}
          </Button>
        </div>
      ) : !signedIn ? (
        <section className="surface-card p-6 text-center">
          <h2 className="font-semibold text-lg">{t("welcomeTitle")}</h2>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground text-sm leading-relaxed">
            {t("welcomeBody")}
          </p>
          <Button
            className="mt-5 rounded-full"
            nativeButton={false}
            render={<Link href="/entrar?callbackUrl=%2Fpasaporte" />}
          >
            {t("signIn")}
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        </section>
      ) : total === 0 ? (
        <section className="surface-card p-8 text-center">
          <Compass className="mx-auto size-8 text-primary" aria-hidden />
          <h2 className="mt-4 font-semibold text-lg">{t("emptyTitle")}</h2>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground text-sm leading-relaxed">
            {t("emptyBody")}
          </p>
          <Button
            className="mt-5 rounded-full"
            nativeButton={false}
            render={<Link href="/mapa" />}
          >
            {t("explore")}
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        </section>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {query.data?.items.map((stamp) => {
              const Icon = Compass;
              return (
                <article
                  key={stamp.id}
                  className="surface-card relative overflow-hidden p-5"
                >
                  <span className="absolute top-4 right-4 flex size-11 rotate-[-12deg] items-center justify-center rounded-full border-2 border-dashed border-primary/30 text-primary">
                    <Stamp className="size-5" aria-hidden />
                  </span>
                  <span className="mb-4 flex size-11 items-center justify-center rounded-xl bg-accent text-primary">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <h3 className="pr-12 font-semibold text-lg leading-snug">
                    {stamp.place?.name ?? t("unavailablePlace")}
                  </h3>
                  {stamp.place && (
                    <p className="mt-2 text-muted-foreground text-sm">
                      {stamp.place.categoryName} ·{" "}
                      {stamp.place.municipalityName}
                    </p>
                  )}
                  <p className="mt-4 text-primary text-xs">
                    <time dateTime={stamp.stampedAt}>
                      {t("collectedOn", {
                        date: format.dateTime(new Date(stamp.stampedAt), {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        }),
                      })}
                    </time>
                  </p>
                  {stamp.place && (
                    <Link
                      href={`/mapa?lugar=${stamp.place.slug}`}
                      className="mt-3 flex min-h-11 items-center gap-2 text-primary text-sm font-medium"
                    >
                      {t("viewPlace")}
                      <ArrowRight className="size-4" aria-hidden />
                    </Link>
                  )}
                </article>
              );
            })}
          </div>
          <nav
            aria-label={t("pagination")}
            className="mt-6 flex items-center justify-between gap-3"
          >
            <Button
              variant="outline"
              className="rounded-full"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              {t("previous")}
            </Button>
            <p className="text-muted-foreground text-sm" role="status">
              {t("page", {
                page: Math.floor(offset / PAGE_SIZE) + 1,
                pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
              })}
            </p>
            <Button
              variant="outline"
              className="rounded-full"
              disabled={offset + PAGE_SIZE >= total}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              {t("next")}
            </Button>
          </nav>
        </>
      )}
    </div>
  );
}
