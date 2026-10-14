"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  LayoutGrid,
  Map as MapIcon,
  Search,
} from "lucide-react";
import { useTranslations } from "next-intl";
import {
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from "nuqs";
import { PlaceRow } from "@/components/discover/place-row";
import { PlaceTile } from "@/components/discover/place-tile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { CategoryTile } from "@/components/ui-patterns/category-tile";
import { EmptyState } from "@/components/ui-patterns/empty-state";
import { ListRowSkeleton } from "@/components/ui-patterns/list-row";
import { Segmented } from "@/components/ui-patterns/segmented";
import { Link } from "@/i18n/navigation";
import { categoryIcon } from "@/lib/map/category-icons";
import { orpc } from "@/lib/orpc";

const PAGE_SIZE = 12;
const VIEWS = ["fotos", "lista"] as const;

/**
 * The province as a directory you browse.
 *
 * Search first, then what kind of place, then which town — the three questions
 * in the order people ask them. Categories are big tiles because they are the
 * fastest way in for somebody who would rather not type; the municipality is
 * three segments because there are exactly three and all of them should be
 * visible. Places show as photo cards by default, since a place is chosen by
 * looking at it; the list is one tap away for scanning names on slow data.
 *
 * Every filter lives in the URL, like the map's, so a link to "balnearios en
 * Monción" is a link somebody can send.
 */
export function PlaceDirectory() {
  const t = useTranslations("discover");
  const [filters, setFilters] = useQueryStates({
    q: parseAsString.withDefault(""),
    category: parseAsString.withDefault(""),
    municipality: parseAsString.withDefault(""),
    page: parseAsInteger.withDefault(1),
    vista: parseAsStringLiteral(VIEWS).withDefault("fotos"),
  });
  const page = Math.min(8334, Math.max(1, filters.page));
  const query = useQuery(
    orpc.places.browse.queryOptions({
      input: {
        query: filters.q.slice(0, 100),
        category: filters.category,
        municipality: filters.municipality,
        offset: (page - 1) * PAGE_SIZE,
        limit: PAGE_SIZE,
      },
    }),
  );
  const categories = useQuery(orpc.places.categories.queryOptions());
  const municipalities = useQuery(orpc.municipalities.list.queryOptions());
  const filtered = Boolean(
    filters.q || filters.category || filters.municipality,
  );
  const grid = filters.vista === "fotos";
  const clear = () =>
    void setFilters({ q: "", category: "", municipality: "", page: 1 });

  return (
    <div>
      <header className="mb-5">
        <h1 className="page-title">{t("title")}</h1>
      </header>

      <div className="flex gap-2">
        <form
          key={filters.q}
          className="relative flex-1"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            void setFilters({
              q: String(data.get("q") ?? "").trim(),
              page: 1,
            });
          }}
        >
          <Search
            className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            name="q"
            enterKeyHint="search"
            aria-label={t("search")}
            defaultValue={filters.q}
            placeholder={t("searchPlaceholder")}
            maxLength={100}
            className="h-12 rounded-full border-border bg-background ps-12 pe-4 text-base shadow-none md:text-base"
          />
        </form>
        <Button
          variant="outline"
          className="h-12 shrink-0 rounded-full px-4 text-[15px]"
          nativeButton={false}
          render={
            <Link
              href={`/mapa${filters.category ? `?cat=${encodeURIComponent(filters.category)}` : ""}`}
            />
          }
        >
          <MapIcon className="size-5" aria-hidden />
          {t("mapShort")}
        </Button>
      </div>

      <fieldset className="mt-5 min-w-0">
        <legend className="sr-only">{t("category")}</legend>
        <div className="-mx-5 flex snap-x scroll-px-5 gap-2.5 overflow-x-auto px-5 pt-1 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0 [&::-webkit-scrollbar]:hidden">
          <CategoryTile
            active={!filters.category}
            onClick={() => void setFilters({ category: "", page: 1 })}
            icon={
              <LayoutGrid className="size-7 text-foreground/80" aria-hidden />
            }
            label={t("allCategories")}
          />
          {categories.isPending
            ? Array.from({ length: 5 }, (_, index) => (
                <Skeleton
                  // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
                  key={index}
                  aria-hidden
                  className="h-[4.75rem] w-[5.75rem] shrink-0 rounded-2xl"
                />
              ))
            : categories.data?.map((item) => {
                const Icon = categoryIcon(item.icon);
                const active = filters.category === item.id;
                return (
                  <CategoryTile
                    key={item.id}
                    active={active}
                    onClick={() =>
                      void setFilters({
                        category: active ? "" : item.id,
                        page: 1,
                      })
                    }
                    icon={
                      <span
                        className="flex size-11 items-center justify-center rounded-full bg-background"
                        style={{ color: item.color }}
                      >
                        <Icon className="size-6" aria-hidden />
                      </span>
                    }
                    label={item.name}
                  />
                );
              })}
        </div>
      </fieldset>

      <Segmented
        className="mt-4 md:max-w-lg"
        label={t("municipality")}
        allowEmpty
        value={filters.municipality}
        onChange={(value) => void setFilters({ municipality: value, page: 1 })}
        options={(municipalities.data ?? []).map((item) => ({
          value: item.id,
          label: item.name,
        }))}
      />

      <div className="mt-6 mb-3 flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <p role="status" className="flex items-center gap-2 text-[15px]">
          <span className="font-semibold">
            {query.data
              ? t("count", { count: query.data.total })
              : t("loading")}
          </span>
          {filtered && (
            <button
              type="button"
              onClick={clear}
              className="min-h-11 rounded-full px-1 text-muted-foreground underline decoration-1 underline-offset-4 hover:text-foreground focus-visible:outline-2"
            >
              {t("clear")}
            </button>
          )}
        </p>
        <Segmented
          className="w-auto"
          label={t("view")}
          value={filters.vista}
          onChange={(value) => value && void setFilters({ vista: value })}
          options={[
            { value: "fotos", label: t("viewGrid") },
            { value: "lista", label: t("viewList") },
          ]}
        />
      </div>

      {query.isPending ? (
        grid ? (
          <div
            role="status"
            className="grid grid-cols-2 gap-x-3 gap-y-6 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-5"
          >
            <span className="sr-only">{t("loading")}</span>
            {Array.from({ length: 6 }, (_, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
              <div key={index} aria-hidden>
                <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
                <Skeleton className="mt-3 h-4 w-4/5" />
                <Skeleton className="mt-2 h-3.5 w-1/2" />
              </div>
            ))}
          </div>
        ) : (
          <ListRowSkeleton label={t("loading")} rows={6} thumb />
        )
      ) : query.isError ? (
        <EmptyState
          illustration="search"
          title={t("error")}
          action={
            <Button
              className="rounded-full px-6"
              onClick={() => void query.refetch()}
            >
              {t("retry")}
            </Button>
          }
        />
      ) : query.data.items.length === 0 ? (
        filtered ? (
          <EmptyState
            illustration="search"
            title={t("empty")}
            action={
              <Button className="rounded-full px-6" onClick={clear}>
                {t("clear")}
              </Button>
            }
          />
        ) : (
          <EmptyState
            illustration="places"
            title={t("emptyAll")}
            action={
              <Button
                className="rounded-full px-6"
                nativeButton={false}
                render={<Link href="/mapa?agregar=true" />}
              >
                {t("addPlace")}
              </Button>
            }
          />
        )
      ) : grid ? (
        <ul className="grid grid-cols-2 gap-x-3 gap-y-6 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-5">
          {query.data.items.map((place, index) => (
            <li key={place.id}>
              <PlaceTile place={place} priority={index < 2} />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="ruled max-w-3xl">
          {query.data.items.map((place) => (
            <li key={place.id}>
              <PlaceRow place={place} />
            </li>
          ))}
        </ul>
      )}

      {query.data && (query.data.total > PAGE_SIZE || page > 1) && (
        <nav
          aria-label={t("pagination")}
          className="mt-10 flex items-center justify-center gap-5"
        >
          <Button
            variant="outline"
            className="rounded-full px-4"
            disabled={page <= 1}
            onClick={() => void setFilters({ page: page - 1 })}
          >
            <ArrowLeft aria-hidden />
            {t("previous")}
          </Button>
          <p className="meta-mono text-sm">
            {t("page", {
              page,
              pages: Math.max(1, Math.ceil(query.data.total / PAGE_SIZE)),
            })}
          </p>
          <Button
            variant="outline"
            className="rounded-full px-4"
            disabled={page * PAGE_SIZE >= query.data.total}
            onClick={() => void setFilters({ page: page + 1 })}
          >
            {t("next")}
            <ArrowRight aria-hidden />
          </Button>
        </nav>
      )}
    </div>
  );
}
