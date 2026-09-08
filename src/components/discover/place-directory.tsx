"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Map as MapIcon,
  Search,
  SearchX,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { parseAsInteger, parseAsString, useQueryStates } from "nuqs";
import { PlaceCard } from "@/components/discover/place-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Link } from "@/i18n/navigation";
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
      <header className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="mb-3 text-xs font-medium text-muted-foreground">
            {t("eyebrow")}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            {t("title")}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">{t("intro")}</p>
        </div>
        <Button
          variant="outline"
          className="h-11 self-start rounded-full px-5"
          nativeButton={false}
          render={
            <Link
              href={`/mapa${filters.category ? `?cat=${encodeURIComponent(filters.category)}` : ""}`}
            />
          }
        >
          <MapIcon aria-hidden />
          {t("viewMap")}
        </Button>
      </header>
      <div className="surface-card mb-8 grid items-end gap-4 p-5 md:grid-cols-[2fr_1fr_1fr]">
        <form
          key={filters.q}
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            void setFilters({ q: String(data.get("q") ?? "").trim(), page: 1 });
          }}
        >
          <Label htmlFor="place-search" className="mb-2">
            {t("search")}
          </Label>
          <div className="relative flex gap-2">
            <Input
              id="place-search"
              name="q"
              defaultValue={filters.q}
              placeholder={t("searchPlaceholder")}
              maxLength={100}
              className="h-11 bg-background"
            />
            <Button
              type="submit"
              className="h-11 px-3"
              aria-label={t("search")}
            >
              <Search className="size-4" aria-hidden />
            </Button>
          </div>
        </form>
        <div>
          <Label htmlFor="category-filter" className="mb-2">
            {t("category")}
          </Label>
          <NativeSelect
            id="category-filter"
            size="lg"
            className="w-full"
            value={filters.category || "all"}
            onChange={(event) => {
              const value = event.target.value;
              void setFilters({
                category: value === "all" ? "" : value,
                page: 1,
              });
            }}
          >
            <NativeSelectOption value="all">
              {t("allCategories")}
            </NativeSelectOption>
            {categories.data?.map((item) => (
              <NativeSelectOption key={item.id} value={item.id}>
                {item.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div>
          <Label htmlFor="municipality-filter" className="mb-2">
            {t("municipality")}
          </Label>
          <NativeSelect
            id="municipality-filter"
            size="lg"
            className="w-full"
            value={filters.municipality || "all"}
            onChange={(event) => {
              const value = event.target.value;
              void setFilters({
                municipality: value === "all" ? "" : value,
                page: 1,
              });
            }}
          >
            <NativeSelectOption value="all">
              {t("allMunicipalities")}
            </NativeSelectOption>
            {municipalities.data?.map((item) => (
              <NativeSelectOption key={item.id} value={item.id}>
                {item.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      </div>
      <div className="mb-5 flex min-h-9 items-center justify-between gap-3">
        <p role="status" className="text-sm text-muted-foreground">
          {query.data ? t("count", { count: query.data.total }) : t("loading")}
        </p>
        {filtered && (
          <Button
            variant="ghost"
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
        <div
          role="status"
          className="flex min-h-60 items-center justify-center gap-2"
        >
          <Spinner className="size-5" />
          <span className="sr-only">{t("loading")}</span>
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
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {query.data.items.map((place) => (
            <PlaceCard key={place.id} place={place} />
          ))}
        </div>
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
