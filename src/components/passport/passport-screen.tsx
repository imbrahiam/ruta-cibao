"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useAuth } from "@/components/auth/auth-context";
import {
  PassportSlot,
  PassportStamp,
  type StampPlace,
} from "@/components/passport/passport-stamp";
import { SignInPrompt } from "@/components/shell/sign-in-prompt";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui-patterns/empty-state";
import { Link } from "@/i18n/navigation";
import { orpc } from "@/lib/orpc";

const PAGE_SIZE = 24;
/** How many places the page asks for, to draw the ones still to visit. */
const PLACES_LIMIT = 48;

/**
 * The passport: a dashed page of stamps, one per place visited, with the
 * places still to visit drawn as empty outlines beside them.
 *
 * The outlines are what turns a list of souvenirs into a goal. They are drawn
 * only while every stamp fits on one page — past that, the page cannot know
 * which places are visited without reading every page, and showing a visited
 * place as "to visit" would be wrong in a way somebody would notice.
 */
export function PassportScreen() {
  const t = useTranslations("passport");
  const onboardingT = useTranslations("onboarding");
  const { viewer, isLoading, isUnavailable } = useAuth();
  const [offset, setOffset] = useState(0);
  const signedIn = viewer !== undefined && viewer.kind !== "anonymous";
  const query = useQuery({
    ...orpc.passport.list.queryOptions({ input: { offset, limit: PAGE_SIZE } }),
    enabled: signedIn,
  });
  const places = useQuery(
    orpc.places.browse.queryOptions({ input: { limit: PLACES_LIMIT } }),
  );

  const loading = isLoading || (signedIn && query.isPending);
  const total = query.data?.total ?? 0;
  const bySlug = new Map(
    (places.data?.items ?? []).map((place) => [place.slug, place]),
  );
  const visited = new Set(
    (query.data?.items ?? []).flatMap((stamp) =>
      stamp.place ? [stamp.place.slug] : [],
    ),
  );
  const showSlots = !signedIn || total <= PAGE_SIZE;
  const slots: StampPlace[] = showSlots
    ? (places.data?.items ?? [])
        .filter((place) => !visited.has(place.slug))
        .map((place) => ({
          name: place.name,
          slug: place.slug,
          municipalityName: place.municipalityName,
          categoryColor: place.categoryColor,
          categoryIcon: place.categoryIcon,
          imageUrl: place.imageUrl,
        }))
    : [];
  const placeTotal = places.data?.total;

  return (
    <div className="max-w-4xl">
      <header className="mb-6">
        <h1 className="page-title">{t("title")}</h1>
      </header>

      {isUnavailable || (signedIn && query.isError) ? (
        <EmptyState
          illustration="stamps"
          title={t("error")}
          action={
            <Button
              className="rounded-full px-6"
              onClick={() =>
                isUnavailable ? window.location.reload() : void query.refetch()
              }
            >
              {t("retry")}
            </Button>
          }
        />
      ) : (
        <>
          {loading ? (
            <Skeleton aria-hidden className="mb-6 h-14 w-48" />
          ) : !signedIn ? (
            <div className="mb-10">
              <SignInPrompt
                photo="/places/presa-moncion.webp"
                photoTitle={onboardingT("shellTitle")}
                title={t("signInTitle")}
                action={t("signIn")}
                href="/entrar?callbackUrl=%2Fpasaporte"
              />
            </div>
          ) : total === 0 ? (
            <EmptyState
              className="mb-6"
              illustration="stamps"
              title={t("emptyTitle")}
              action={
                <Button
                  className="h-11 rounded-full px-6"
                  nativeButton={false}
                  render={<Link href="/mapa" />}
                >
                  {t("explore")}
                </Button>
              }
            />
          ) : (
            <p className="mb-6 flex items-baseline gap-3" role="status">
              <span className="stat-number">{total}</span>
              <span className="text-[17px] text-muted-foreground">
                {placeTotal !== undefined && placeTotal >= total
                  ? t("progress", { count: total, total: placeTotal })
                  : t("count", { count: total })}
              </span>
            </p>
          )}

          {/* The page itself: dashed like a passport's, on a soft tile so the
              white stamps stand off it by tone rather than by shadow. */}
          <section
            aria-label={t("pageLabel")}
            className="rounded-[1.75rem] border-2 border-foreground/15 border-dashed bg-secondary p-4 pt-6 sm:p-7"
          >
            {loading || places.isPending ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
                {Array.from({ length: 4 }, (_, index) => (
                  <Skeleton
                    // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
                    key={index}
                    aria-hidden
                    className="aspect-[4/5.6] w-full rounded-md bg-background"
                  />
                ))}
              </div>
            ) : (
              <ul className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4">
                {(query.data?.items ?? []).map((stamp, index) => {
                  const known = stamp.place
                    ? bySlug.get(stamp.place.slug)
                    : undefined;
                  return (
                    <li key={stamp.id}>
                      <PassportStamp
                        index={index}
                        stampedAt={stamp.stampedAt}
                        place={
                          stamp.place
                            ? {
                                ...stamp.place,
                                categoryIcon: known?.categoryIcon,
                                imageUrl: known?.imageUrl ?? null,
                              }
                            : null
                        }
                      />
                    </li>
                  );
                })}
                {slots.map((place) => (
                  <li key={place.slug}>
                    <PassportSlot place={place} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {signedIn && total > PAGE_SIZE && (
            <nav
              aria-label={t("pagination")}
              className="mt-6 flex items-center justify-center gap-5"
            >
              <Button
                variant="outline"
                className="rounded-full px-4"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              >
                <ArrowLeft aria-hidden />
                {t("previous")}
              </Button>
              <p className="meta-mono text-sm" role="status">
                {t("page", {
                  page: Math.floor(offset / PAGE_SIZE) + 1,
                  pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
                })}
              </p>
              <Button
                variant="outline"
                className="rounded-full px-4"
                disabled={offset + PAGE_SIZE >= total}
                onClick={() => setOffset(offset + PAGE_SIZE)}
              >
                {t("next")}
                <ArrowRight aria-hidden />
              </Button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
