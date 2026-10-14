"use client";

import { useQuery } from "@tanstack/react-query";
import { useMapsLibrary } from "@vis.gl/react-google-maps";
import { ChevronRight, Clock, MapPin, Search, Store, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useMediaQuery } from "@/hooks/use-media-query";
import { categoryIcon } from "@/lib/map/category-icons";
import { PROVINCE_BOUNDS } from "@/lib/map/config";
import { labelInk } from "@/lib/map/marker-pin";
import { orpc } from "@/lib/orpc";

export type SearchTarget = {
  lng: number;
  lat: number;
  label: string;
  slug?: string;
};

/**
 * What was chosen before, newest first.
 *
 * Per device and never sent anywhere: a search history is exactly the kind of
 * thing a municipality should not hold about its residents. Five is enough to
 * catch "the clinic again" without becoming a log.
 */
const RECENT_KEY = "ruta-cibao:recent-searches";
const RECENT_MAX = 5;

function readRecent(): SearchTarget[] {
  try {
    const parsed: unknown = JSON.parse(
      window.localStorage.getItem(RECENT_KEY) ?? "[]",
    );
    return Array.isArray(parsed)
      ? (parsed as SearchTarget[])
          .filter(
            (item) =>
              typeof item?.label === "string" &&
              Number.isFinite(item.lng) &&
              Number.isFinite(item.lat),
          )
          .slice(0, RECENT_MAX)
      : [];
  } catch {
    return [];
  }
}

function writeRecent(items: SearchTarget[]) {
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(items));
  } catch {
    // Private mode: the list simply does not persist.
  }
}

const ROW =
  "flex min-h-14 items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const SECTION =
  "px-3 pt-4 pb-1 font-medium text-muted-foreground text-xs uppercase tracking-wide";

type GooglePlace = {
  id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
};

/**
 * Google's own listings for the same term.
 *
 * A hook rather than a component so its loading state belongs to the search
 * screen. Two sources answering one question produced two spinners stacked on
 * top of each other, which reads as the app being confused about what it is
 * doing; there is one question, so there is one "buscando".
 */
function useGooglePlaces(term: string, enabled: boolean) {
  const placesLibrary = useMapsLibrary("places");
  const trimmed = term.trim();

  return useQuery({
    queryKey: ["google-places", "text", trimmed],
    enabled: enabled && Boolean(placesLibrary) && trimmed.length >= 2,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<GooglePlace[]> => {
      if (!placesLibrary) return [];
      const [west, south, east, north] = PROVINCE_BOUNDS;
      const response = await placesLibrary.Place.searchByText({
        textQuery: trimmed,
        fields: ["id", "displayName", "formattedAddress", "location"],
        language: "es",
        region: "DO",
        maxResultCount: 5,
        locationRestriction: { west, south, east, north },
      });

      return response.places.flatMap((place) => {
        const location = place.location;
        const name = place.displayName?.trim();
        if (!location || !name) return [];
        return [
          {
            id: place.id,
            name,
            address: place.formattedAddress ?? null,
            lat: location.lat(),
            lng: location.lng(),
          },
        ];
      });
    },
  });
}

/**
 * Finding something on the map.
 *
 * A field that looks like a field but opens a drawer, so the keyboard and the
 * results share the bottom of the screen where the thumb is, instead of the
 * results pushing the map out of view from the top.
 *
 * Three groups, never merged: what the province has put on the map, what
 * Google knows about businesses, and what the geocoder knows about addresses.
 * They mean different things — one is a place someone vouched for, the others
 * are a listing and a coordinate — and collapsing them into one ranked list
 * would hide which is which. One spinner covers all three, because from the
 * outside it is one search.
 *
 * Places answer as you type: they come from this server's own database.
 * Addresses do not. The geocoder behind them is a shared public service whose
 * terms forbid autocomplete, so it is asked once, when the person submits or
 * taps "buscar como dirección" — which is also faster on 3G than five
 * half-typed requests racing each other back.
 */
export function MapSearch({
  onSelect,
  googlePlacesEnabled,
}: {
  onSelect: (target: SearchTarget) => void;
  googlePlacesEnabled: boolean;
}) {
  const t = useTranslations("map.search");
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [debouncedTerm, setDebouncedTerm] = useState("");
  /** The term addresses were last asked for; null until the person submits. */
  const [addressTerm, setAddressTerm] = useState<string | null>(null);
  const [recent, setRecent] = useState<SearchTarget[]>([]);
  const { data: allCategories } = useQuery({
    ...orpc.places.categories.queryOptions(),
    enabled: open,
  });
  const categories = allCategories?.filter(
    (category) => category.kind === "place",
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedTerm(term), 250);
    return () => window.clearTimeout(timeout);
  }, [term]);

  useEffect(() => {
    if (open) setRecent(readRecent());
  }, [open]);

  const trimmed = term.trim();
  const query = useQuery({
    ...orpc.places.search.queryOptions({
      input: { query: debouncedTerm.trim() },
    }),
    // Below two characters every query matches, which is noise, not results.
    enabled: debouncedTerm.trim().length >= 2,
    placeholderData: (previous) => previous,
  });
  const addressQuery = useQuery({
    ...orpc.places.search.queryOptions({
      input: { query: addressTerm ?? "", addresses: true },
    }),
    enabled: addressTerm !== null && addressTerm.length >= 2,
    staleTime: 10 * 60 * 1000,
  });
  const google = useGooglePlaces(debouncedTerm, googlePlacesEnabled);

  // A new term makes an earlier address answer stale.
  useEffect(() => {
    if (addressTerm !== null && addressTerm !== trimmed) setAddressTerm(null);
  }, [addressTerm, trimmed]);

  function choose(target: SearchTarget) {
    const next = [
      target,
      ...readRecent().filter(
        (item) =>
          item.label !== target.label ||
          item.lng !== target.lng ||
          item.lat !== target.lat,
      ),
    ].slice(0, RECENT_MAX);
    writeRecent(next);
    onSelect(target);
    setOpen(false);
    setTerm("");
    setAddressTerm(null);
  }

  function searchAddresses() {
    if (trimmed.length >= 2) setAddressTerm(trimmed);
  }

  const results = trimmed.length >= 2 ? query.data : undefined;
  const addresses =
    addressTerm === trimmed ? (addressQuery.data?.addresses ?? []) : [];
  const geocoder = query.data?.geocoder ?? false;
  const ownNames = new Set(
    (results?.places ?? []).map((place) =>
      place.name.trim().toLocaleLowerCase("es"),
    ),
  );
  // Google's copy of a place the province already published is noise: the
  // province's row is the one with a category, a moderator and a report button.
  const googlePlaces = (google.data ?? []).filter(
    (place) => !ownNames.has(place.name.toLocaleLowerCase("es")),
  );

  const searching =
    (query.isFetching && !results) ||
    addressQuery.isFetching ||
    (googlePlacesEnabled && google.isFetching);
  const total =
    (results?.places.length ?? 0) + addresses.length + googlePlaces.length;
  const searched = trimmed.length >= 2 && debouncedTerm.trim() === trimmed;
  const addressesAsked = addressTerm === trimmed && addressQuery.isSuccess;

  return (
    <Drawer
      open={open}
      onOpenChange={setOpen}
      showSwipeHandle={!isDesktop}
      swipeDirection={isDesktop ? "right" : "down"}
    >
      <DrawerTrigger
        render={
          <button
            type="button"
            className="flex h-12 w-full items-center gap-3 rounded-full border border-black/[0.06] bg-card px-4 text-left text-[15px] text-muted-foreground shadow-[0_1px_2px_rgb(0_0_0/0.06),0_4px_14px_-4px_rgb(0_0_0/0.16)] transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:max-w-md"
          >
            <Search
              className="size-[18px] shrink-0 text-foreground/70"
              aria-hidden
            />
            <span className="truncate text-[15px]">{t("placeholder")}</span>
          </button>
        }
      />

      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="sr-only">{t("title")}</DrawerTitle>
          {/* A form so the keyboard's search key is the submit, which is the
              one moment addresses are asked for. */}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              searchAddresses();
            }}
            className="relative"
          >
            <Search
              className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-4 size-[18px] text-muted-foreground"
              aria-hidden
            />
            <Input
              // The drawer exists only to type into; not focusing it means a
              // second tap on a phone that already opened the keyboard.
              autoFocus
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder={t("placeholder")}
              aria-label={t("title")}
              className="h-12 rounded-full bg-muted/60 pr-11 pl-11 text-base md:text-base [&::-webkit-search-cancel-button]:hidden"
              enterKeyHint="search"
              type="search"
              autoComplete="off"
            />
            {term.length > 0 && (
              <button
                type="button"
                onClick={() => setTerm("")}
                aria-label={t("clear")}
                className="-translate-y-1/2 absolute top-1/2 right-2 flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-4" aria-hidden />
              </button>
            )}
          </form>
        </DrawerHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain px-3 pb-[max(2rem,env(safe-area-inset-bottom))]">
          {/* Something to tap before anything is typed. A blank box asks
              people to know what to call what they want; the province's own
              categories, with their icons, answer that for them — and the
              search matches on category, so "Salud" finds the hospital. */}
          {trimmed.length < 2 && categories && categories.length > 0 && (
            <>
              <p className={SECTION}>{t("suggestions")}</p>
              <div className="flex flex-wrap gap-2 px-1 pb-2">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setTerm(category.name)}
                    className="flex h-11 items-center gap-2 rounded-full border bg-background px-3.5 font-medium text-[15px] transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <CategoryGlyph
                      icon={category.icon}
                      color={labelInk(category.color)}
                    />
                    {category.name}
                  </button>
                ))}
              </div>
            </>
          )}

          {trimmed.length < 2 && recent.length > 0 && (
            <>
              <div className="flex items-center justify-between pr-1">
                <p className={SECTION}>{t("recent")}</p>
                <button
                  type="button"
                  onClick={() => {
                    writeRecent([]);
                    setRecent([]);
                  }}
                  className="mt-3 rounded-full px-2.5 py-1 font-medium text-muted-foreground text-xs hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {t("clearRecent")}
                </button>
              </div>
              {recent.map((item) => (
                <button
                  key={`${item.label}-${item.lng}-${item.lat}`}
                  type="button"
                  onClick={() => choose(item)}
                  className={ROW}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Clock
                      className="size-4 text-muted-foreground"
                      aria-hidden
                    />
                  </span>
                  <span className="line-clamp-2 min-w-0 flex-1 text-base leading-snug">
                    {item.label}
                  </span>
                </button>
              ))}
            </>
          )}

          {searching && (
            <p
              className="flex items-center gap-2 px-2 py-3 text-muted-foreground text-sm"
              role="status"
            >
              <Spinner className="size-4" /> {t("searching")}
            </p>
          )}

          {results?.places.map((place) => (
            <button
              key={place.slug}
              type="button"
              onClick={() =>
                choose({
                  lng: place.lng,
                  lat: place.lat,
                  label: place.name,
                  slug: place.slug,
                })
              }
              className={ROW}
            >
              <span
                aria-hidden
                className="flex size-9 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: `${place.color}1f` }}
              >
                {/* The category's own icon, as on the chips and the pins: a
                    fork says "comedor" to someone who has not learned what a
                    colour stands for. */}
                <CategoryGlyph
                  icon={place.categoryIcon}
                  color={labelInk(place.color)}
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 block text-base leading-snug">
                  {place.name}
                </span>
                <span className="block truncate text-muted-foreground text-xs">
                  {place.categoryName} · {place.municipalityName}
                </span>
              </span>
            </button>
          ))}

          {googlePlaces.length > 0 && (
            <p className={SECTION}>{t("googlePlaces")}</p>
          )}

          {googlePlaces.map((place) => (
            <button
              key={place.id}
              type="button"
              onClick={() =>
                choose({ lng: place.lng, lat: place.lat, label: place.name })
              }
              className={ROW}
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                <Store className="size-4 text-muted-foreground" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 block text-base leading-snug">
                  {place.name}
                </span>
                {place.address && (
                  <span className="block truncate text-muted-foreground text-xs">
                    {place.address}
                  </span>
                )}
              </span>
            </button>
          ))}

          {geocoder && trimmed.length >= 2 && !addressesAsked && (
            <button type="button" onClick={searchAddresses} className={ROW}>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                <MapPin className="size-4 text-muted-foreground" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 block text-base leading-snug">
                  {t("searchAddress", { term: trimmed })}
                </span>
                <span className="block truncate text-muted-foreground text-xs">
                  {t("searchAddressHint")}
                </span>
              </span>
              <ChevronRight
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
            </button>
          )}

          {addresses.length > 0 && <p className={SECTION}>{t("addresses")}</p>}

          {addressesAsked && addresses.length === 0 && total > 0 && (
            <p
              className="rounded-xl bg-muted px-3 py-2 text-muted-foreground text-sm"
              role="status"
            >
              {t("noAddresses")}
            </p>
          )}

          {addresses.map((address) => (
            <button
              key={`${address.lng},${address.lat}`}
              type="button"
              onClick={() =>
                choose({
                  lng: address.lng,
                  lat: address.lat,
                  label: address.name,
                })
              }
              className={ROW}
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                <MapPin className="size-4 text-muted-foreground" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 block text-base leading-snug">
                  {address.name}
                </span>
                {address.context && (
                  <span className="block truncate text-muted-foreground text-xs">
                    {address.context}
                  </span>
                )}
              </span>
            </button>
          ))}

          {google.isError && googlePlaces.length === 0 && (
            <p
              className="rounded-lg bg-muted px-3 py-2 text-muted-foreground text-sm"
              role="status"
            >
              {t("googleUnavailable")}
            </p>
          )}

          {searched &&
            !searching &&
            total === 0 &&
            (!geocoder || addressesAsked) && (
              <Empty className="py-8">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Search />
                  </EmptyMedia>
                  <EmptyTitle>{t("noResults", { term })}</EmptyTitle>
                  <EmptyDescription>{t("noResultsHint")}</EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function CategoryGlyph({ icon, color }: { icon: string; color: string }) {
  const Icon = categoryIcon(icon);
  return <Icon className="size-[18px]" style={{ color }} aria-hidden />;
}
