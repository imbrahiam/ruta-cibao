"use client";

import { useQuery } from "@tanstack/react-query";
import { useMapsLibrary } from "@vis.gl/react-google-maps";
import {
  ChevronRight,
  MapPin,
  MessageCircleQuestionMark,
  Search,
  Store,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { ASSISTANT_OPEN_EVENT } from "@/components/assistant/assistant-panel";
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
import { PROVINCE_BOUNDS } from "@/lib/map/config";
import { orpc } from "@/lib/orpc";

export type SearchTarget = {
  lng: number;
  lat: number;
  label: string;
  slug?: string;
};

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

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedTerm(term), 250);
    return () => window.clearTimeout(timeout);
  }, [term]);

  const query = useQuery({
    ...orpc.places.search.queryOptions({ input: { query: term } }),
    // Below two characters every query matches, which is noise, not results.
    enabled: term.trim().length >= 2,
  });
  const google = useGooglePlaces(debouncedTerm, googlePlacesEnabled);

  function choose(target: SearchTarget) {
    onSelect(target);
    setOpen(false);
    setTerm("");
  }

  // Hands over to the assistant: the search drawer folds away and the chat
  // opens on top, with the typed words carried over as its first question.
  function askAssistant() {
    const question = term.trim();
    setOpen(false);
    setTerm("");
    window.setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent(ASSISTANT_OPEN_EVENT, { detail: { question } }),
      );
    }, 150);
  }

  const results = query.data;
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
    query.isFetching || (googlePlacesEnabled && google.isFetching);
  const total =
    (results?.places.length ?? 0) +
    (results?.addresses.length ?? 0) +
    googlePlaces.length;
  const searched = term.trim().length >= 2 && debouncedTerm.trim().length >= 2;

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
            className="flex h-12 w-full items-center gap-3 rounded-full border bg-background px-4 text-left text-muted-foreground shadow-md md:max-w-md"
          >
            <Search className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{t("placeholder")}</span>
          </button>
        }
      />

      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="sr-only">{t("title")}</DrawerTitle>
          <Input
            // The drawer exists only to type into; not focusing it means a
            // second tap on a phone that already opened the keyboard.
            autoFocus
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder={t("placeholder")}
            className="h-12 text-base md:text-base"
            enterKeyHint="search"
            type="search"
          />
        </DrawerHeader>

        <div className="flex flex-col gap-1 overflow-y-auto px-4 pb-8">
          {/* The assistant, as a suggestion: describing what is needed in
              plain words is a search of its own, and this is where someone
              looking would think to find it. */}
          <button
            type="button"
            onClick={askAssistant}
            className="flex min-h-14 items-center gap-3 rounded-lg bg-accent/50 px-3 py-2 text-left transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <MessageCircleQuestionMark
              className="size-5 shrink-0 text-primary"
              aria-hidden
            />
            <span className="min-w-0 flex-1">
              <span className="block text-base">{t("askAiTitle")}</span>
              <span className="block truncate text-muted-foreground text-xs">
                {t("askAiHint")}
              </span>
            </span>
            <ChevronRight
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
          </button>

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
              className="flex h-14 items-center gap-3 rounded-lg px-3 text-left transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span
                aria-hidden
                className="size-3 shrink-0 rounded-full"
                style={{ backgroundColor: place.color }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base">{place.name}</span>
                <span className="block truncate text-muted-foreground text-xs">
                  {place.categoryName} · {place.municipalityName}
                </span>
              </span>
            </button>
          ))}

          {googlePlaces.length > 0 && (
            <p className="px-3 pt-4 pb-1 font-medium text-muted-foreground text-xs uppercase tracking-wide">
              {t("googlePlaces")}
            </p>
          )}

          {googlePlaces.map((place) => (
            <button
              key={place.id}
              type="button"
              onClick={() =>
                choose({ lng: place.lng, lat: place.lat, label: place.name })
              }
              className="flex min-h-14 items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Store
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base">{place.name}</span>
                {place.address && (
                  <span className="block truncate text-muted-foreground text-xs">
                    {place.address}
                  </span>
                )}
              </span>
            </button>
          ))}

          {(results?.addresses.length ?? 0) > 0 && (
            <p className="px-3 pt-4 pb-1 font-medium text-muted-foreground text-xs uppercase tracking-wide">
              {t("addresses")}
            </p>
          )}

          {results?.addresses.map((address) => (
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
              className="flex h-14 items-center gap-3 rounded-lg px-3 text-left transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <MapPin
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base">{address.name}</span>
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

          {searched && !searching && total === 0 && (
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
