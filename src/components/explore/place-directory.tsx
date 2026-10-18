"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Bookmark, MapPinned, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { parseAsString, useQueryState } from "nuqs";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-context";
import { CategoryIcon } from "@/components/places/category-icon";
import { PlaceCard } from "@/components/places/place-card";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/field";
import { Placeholder } from "@/components/ui/loading";
import { Segmented } from "@/components/ui/segmented";
import { Chip } from "@/components/ui/tag";
import { client, orpc } from "@/lib/orpc";

const PAGE = 12;

export function PlaceDirectory() {
  const t = useTranslations("explore");
  const { isSignedIn } = useAuth();
  const [view, setView] = useQueryState(
    "ver",
    parseAsString.withDefault("todos"),
  );
  return (
    <div className="flex flex-col gap-6">
      {isSignedIn ? (
        <Segmented
          label={t("viewLabel")}
          value={view === "guardados" ? "guardados" : "todos"}
          onChange={(value) => void setView(value === "todos" ? null : value)}
          className="self-start"
          options={[
            { value: "todos", label: t("all") },
            { value: "guardados", label: t("saved") },
          ]}
        />
      ) : null}
      {view === "guardados" && isSignedIn ? <SavedPlaces /> : <AllPlaces />}
    </div>
  );
}

function AllPlaces() {
  const t = useTranslations("explore");
  const [query, setQuery] = useQueryState("q", parseAsString.withDefault(""));
  const [category, setCategory] = useQueryState(
    "cat",
    parseAsString.withDefault(""),
  );
  const [municipality, setMunicipality] = useQueryState(
    "municipio",
    parseAsString.withDefault(""),
  );
  const [term, setTerm] = useState(query);
  const categories = useQuery(orpc.places.categories.queryOptions());
  const municipalities = useQuery(orpc.municipalities.list.queryOptions());

  useEffect(() => {
    const timer = setTimeout(() => void setQuery(term.trim() || null), 250);
    return () => clearTimeout(timer);
  }, [term, setQuery]);

  const places = useInfiniteQuery({
    queryKey: ["places", "browse", { query, category, municipality }],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      client.places.browse({
        query,
        category,
        municipality,
        offset: pageParam,
        limit: PAGE,
      }),
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((sum, page) => sum + page.items.length, 0);
      return loaded < last.total ? loaded : undefined;
    },
  });

  const items = places.data?.pages.flatMap((page) => page.items) ?? [];
  const total = places.data?.pages[0]?.total ?? 0;
  const filtered = Boolean(query || category || municipality);

  return (
    <>
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <label className="relative flex-1">
          <span className="sr-only">{t("searchLabel")}</span>
          <Search
            strokeWidth={1.5}
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-ink-3"
          />
          <input
            type="search"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder={t("searchPlaceholder")}
            className="h-12 w-full rounded-full bg-card pr-4 pl-11 text-[16px] text-ink shadow-ring outline-none placeholder:text-ink-3 focus:shadow-[0_0_0_1px_var(--accent),0_0_0_4px_var(--accent-soft)]"
          />
        </label>
        <div className="md:w-60">
          <Select
            aria-label={t("municipality")}
            value={municipality}
            onChange={(event) =>
              void setMunicipality(event.target.value || null)
            }
            className="h-12 rounded-full pl-5"
          >
            <option value="">{t("allMunicipalities")}</option>
            {(municipalities.data ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
        <Chip selected={!category} onClick={() => void setCategory(null)}>
          {t("allCategories")}
        </Chip>
        {(categories.data ?? []).map((item) => (
          <Chip
            key={item.id}
            selected={category === item.id}
            onClick={() =>
              void setCategory(category === item.id ? null : item.id)
            }
          >
            <span
              className="flex"
              style={category === item.id ? undefined : { color: item.color }}
            >
              <CategoryIcon icon={item.icon} />
            </span>
            {item.name}
          </Chip>
        ))}
      </div>

      <p className="t-small text-ink-3" aria-live="polite">
        {places.isPending ? t("loading") : t("count", { count: total })}
      </p>

      {places.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((key) => (
            <Placeholder key={key} className="h-72" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={MapPinned}
          title={filtered ? t("emptyFiltered") : t("empty")}
          body={filtered ? t("emptyFilteredHint") : t("emptyHint")}
          action={
            filtered ? (
              <Button
                onClick={() => {
                  setTerm("");
                  void setCategory(null);
                  void setMunicipality(null);
                }}
              >
                {t("clearFilters")}
              </Button>
            ) : (
              <ButtonLink href="/mapa?reportar=lugar" variant="primary">
                {t("addPlace")}
              </ButtonLink>
            )
          }
        />
      ) : (
        <ul className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((place) => (
            <li key={place.id} className="flex">
              <PlaceCard
                place={{
                  slug: place.slug,
                  name: place.name,
                  description: place.description,
                  imageUrl: place.imageUrl,
                  categoryName: place.categoryName,
                  categoryIcon: place.categoryIcon,
                  categoryColor: place.categoryColor,
                  municipalityName: place.municipalityName,
                }}
              />
            </li>
          ))}
        </ul>
      )}
      {places.hasNextPage ? (
        <Button
          className="self-center"
          onClick={() => void places.fetchNextPage()}
          disabled={places.isFetchingNextPage}
        >
          {places.isFetchingNextPage ? t("loading") : t("more")}
        </Button>
      ) : null}
    </>
  );
}

function SavedPlaces() {
  const t = useTranslations("explore");
  const saved = useQuery(orpc.places.saved.queryOptions());
  if (saved.isPending) return <Placeholder className="h-72" />;
  const items = saved.data ?? [];
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Bookmark}
        title={t("savedEmpty")}
        body={t("savedEmptyHint")}
        action={
          <ButtonLink href="/mapa" variant="primary">
            {t("openMap")}
          </ButtonLink>
        }
      />
    );
  }
  return (
    <ul className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((place) => (
        <li key={place.id} className="flex">
          <PlaceCard
            place={{
              slug: place.slug,
              name: place.name,
              categoryName: place.categoryName,
              categoryIcon: place.icon,
              categoryColor: place.color,
              municipalityName: place.municipalityName,
            }}
          />
        </li>
      ))}
    </ul>
  );
}
