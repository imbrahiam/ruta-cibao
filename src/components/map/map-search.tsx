"use client";

import { useQuery } from "@tanstack/react-query";
import { MapPin, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
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
import { orpc } from "@/lib/orpc";

export type SearchTarget = { lng: number; lat: number; slug?: string };

/**
 * Finding something on the map.
 *
 * A field that looks like a field but opens a drawer, so the keyboard and the
 * results share the bottom of the screen where the thumb is, instead of the
 * results pushing the map out of view from the top.
 *
 * Two groups, never merged: what the province has put on the map, and what the
 * geocoder knows about addresses. They mean different things — one is a place
 * someone vouched for, the other is a coordinate — and collapsing them into one
 * ranked list would hide which is which.
 */
export function MapSearch({
  onSelect,
}: {
  onSelect: (target: SearchTarget) => void;
}) {
  const t = useTranslations("map.search");
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");

  const query = useQuery({
    ...orpc.places.search.queryOptions({ input: { query: term } }),
    // Below two characters every query matches, which is noise, not results.
    enabled: term.trim().length >= 2,
  });

  function choose(target: SearchTarget) {
    onSelect(target);
    setOpen(false);
    setTerm("");
  }

  const results = query.data;
  const hasResults =
    (results?.places.length ?? 0) + (results?.addresses.length ?? 0) > 0;

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger
        render={
          <button
            type="button"
            className="flex h-12 w-full max-w-md items-center gap-3 rounded-full border bg-background px-4 text-left text-muted-foreground shadow-md"
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
            // eslint-disable-next-line jsx-a11y/no-autofocus -- the drawer
            // exists only to type into; not focusing it would mean a second tap.
            autoFocus
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder={t("placeholder")}
            className="h-12 text-base"
            enterKeyHint="search"
            type="search"
          />
        </DrawerHeader>

        <div className="flex flex-col gap-1 px-4 pb-8">
          {query.isFetching && (
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
                choose({ lng: place.lng, lat: place.lat, slug: place.slug })
              }
              className="flex h-14 items-center gap-3 rounded-lg px-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

          {(results?.addresses.length ?? 0) > 0 && (
            <p className="px-3 pt-4 pb-1 font-medium text-muted-foreground text-xs uppercase tracking-wide">
              {t("addresses")}
            </p>
          )}

          {results?.addresses.map((address) => (
            <button
              key={`${address.lng},${address.lat}`}
              type="button"
              onClick={() => choose({ lng: address.lng, lat: address.lat })}
              className="flex h-14 items-center gap-3 rounded-lg px-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

          {term.trim().length >= 2 && !query.isFetching && !hasResults && (
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
