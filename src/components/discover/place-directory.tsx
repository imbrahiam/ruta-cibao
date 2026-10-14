"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  LayoutGrid,
  Map as MapIcon,
  Search,
  SearchX,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { parseAsInteger, parseAsString, useQueryStates } from "nuqs";
import { PlaceRow } from "@/components/discover/place-row";
import { FilterChip } from "@/components/map/category-chips";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { categoryIcon } from "@/lib/map/category-icons";
import { orpc } from "@/lib/orpc";

const PAGE_SIZE = 12;

export function PlaceDirectory() {
  const t = useTranslations("discover");
  const [filters, setFilters] = useQueryStates({
    q: parseAsString.withDefault(""),
    category: parseAsString.withDefault(""),
    municipality: parseAsString.withDefault(""),
    page: parseAsInteger.withDefault(1),
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
  return (
    <div>
      <header className="mb-5">
        <h1 className="page-title">{t("title")}</h1>
        <p className="page-lede mt-2">{t("intro")}</p>
      </header>
      {/* Search and filters stay in reach while the list scrolls, and use the
          same pill-and-chip language as the map, so nothing here has to be
          learned twice. */}
      <div className="sticky top-0 z-10 -mx-5 mb-4 space-y-3 bg-background/95 px-5 pt-2 pb-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
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
              className="h-12 rounded-full ps-12 pe-4 shadow-sm"
            />
          </form>
          <Button
            variant="outline"
            size="icon"
            className="size-12 shrink-0 rounded-full shadow-sm"
            aria-label={t("viewMap")}
            nativeButton={false}
            render={
              <Link
                href={`/mapa${filters.category ? `?cat=${encodeURIComponent(filters.category)}` : ""}`}
              />
            }
          >
            <MapIcon className="size-5" aria-hidden />
          </Button>
        </div>
        <fieldset className="min-w-0">
          <legend className="sr-only">{t("category")}</legend>
          <div className="-mx-5 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <FilterChip
              active={!filters.category}
              onClick={() => void setFilters({ category: "", page: 1 })}
            >
              <LayoutGrid className="size-4" aria-hidden />
              {t("allCategories")}
            </FilterChip>
            {categories.data?.map((item) => {
              const Icon = categoryIcon(item.icon);
              const active = filters.category === item.id;
              return (
                <FilterChip
                  key={item.id}
                  active={active}
                  onClick={() =>
                    void setFilters({
                      category: active ? "" : item.id,
                      page: 1,
                    })
                  }
                >
                  <Icon
                    className="size-4"
                    style={active ? undefined : { color: item.color }}
                    aria-hidden
                  />
                  {item.name}
                </FilterChip>
              );
            })}
          </div>
        </fieldset>
        <fieldset className="min-w-0">
          <legend className="sr-only">{t("municipality")}</legend>
          <div className="-mx-5 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {[
              { id: "", name: t("allMunicipalities") },
              ...(municipalities.data ?? []),
            ].map((item) => (
              <button
                key={item.id || "all"}
                type="button"
                aria-pressed={filters.municipality === item.id}
                onClick={() =>
                  void setFilters({ municipality: item.id, page: 1 })
                }
                className="h-9 shrink-0 whitespace-nowrap rounded-full px-3.5 font-medium text-muted-foreground text-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-primary/10 aria-pressed:text-primary"
              >
                {item.name}
              </button>
            ))}
          </div>
        </fieldset>
      </div>
      <div className="mb-2 flex min-h-9 items-center justify-between gap-3">
        <p role="status" className="text-muted-foreground text-sm">
          {query.data ? t("count", { count: query.data.total }) : t("loading")}
        </p>
        {filtered && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 px-3"
            onClick={() =>
              void setFilters({
                q: "",
                category: "",
                municipality: "",
                page: 1,
              })
            }
          >
            <X aria-hidden />
            {t("clear")}
          </Button>
        )}
      </div>
      {query.isPending ? (
        // The shape of what is coming rather than a spinner in a void: the
        // grid holds its place, so nothing jumps when the cards arrive.
        <div
          role="status"
          className="grid grid-cols-1 gap-1 md:grid-cols-2 md:gap-x-6"
        >
          <span className="sr-only">{t("loading")}</span>
          {Array.from({ length: 6 }, (_, index) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
              key={index}
              aria-hidden
              className="flex min-h-24 items-center gap-4 p-2"
            >
              <Skeleton className="size-20 shrink-0 rounded-xl" />
              <div className="flex-1 space-y-2.5">
                <Skeleton className="h-3 w-1/4" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : query.isError ? (
        <div className="surface-card p-10 text-center">
          <p role="alert" className="mb-4 text-sm text-muted-foreground">
            {t("error")}
          </p>
          <Button onClick={() => void query.refetch()}>{t("retry")}</Button>
        </div>
      ) : query.data.items.length === 0 ? (
        <div className="surface-card flex flex-col items-center gap-3 px-6 py-16 text-center">
          <SearchX className="mb-2 size-8 text-muted-foreground" aria-hidden />
          <h2 className="text-lg font-medium">{t("empty")}</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            {t("emptyHint")}
          </p>
          <Button
            className="mt-3"
            nativeButton={false}
            render={<Link href="/mapa?agregar=true" />}
          >
            {t("addPlace")}
          </Button>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-1 md:grid-cols-2 md:gap-x-6">
          {query.data.items.map((place) => (
            <li key={place.id}>
              <PlaceRow place={place} />
            </li>
          ))}
        </ul>
      )}
      {query.data && (query.data.total > PAGE_SIZE || page > 1) && (
        <div className="mt-8 flex items-center justify-center gap-5">
          <Button
            variant="outline"
            disabled={page <= 1}
            onClick={() => void setFilters({ page: page - 1 })}
            aria-label={t("previous")}
          >
            <ArrowLeft aria-hidden />
          </Button>
          <p className="text-sm text-muted-foreground">
            {t("page", {
              page,
              pages: Math.max(1, Math.ceil(query.data.total / PAGE_SIZE)),
            })}
          </p>
          <Button
            variant="outline"
            disabled={page * PAGE_SIZE >= query.data.total}
            onClick={() => void setFilters({ page: page + 1 })}
            aria-label={t("next")}
          >
            <ArrowRight aria-hidden />
          </Button>
        </div>
      )}
    </div>
  );
}
