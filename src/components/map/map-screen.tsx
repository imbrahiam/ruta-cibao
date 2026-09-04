"use client";

import {
  parseAsArrayOf,
  parseAsBoolean,
  parseAsString,
  useQueryState,
} from "nuqs";
import { useCallback, useState } from "react";
import { CategoryFilter } from "@/components/map/category-filter";
import { CitizenMap } from "@/components/map/citizen-map";
import { MapSearch, type SearchTarget } from "@/components/map/map-search";
import { PlaceDrawer } from "@/components/map/place-drawer";
import { TrafficToggle } from "@/components/map/traffic-toggle";

/**
 * The map screen.
 *
 * Which place is open lives in the URL rather than in component state. That
 * makes a view shareable by pasting the address, survivable across the reload a
 * phone does when it drops signal, and closable with the back button — which is
 * the gesture people reach for before they look for a close affordance.
 *
 * The tile carries the feature id, and the drawer needs the slug, so both are
 * kept: the slug in the URL because it is what a person would read, the id in
 * memory because it is what the map matches when highlighting the selection.
 */
export function MapScreen() {
  const [slug, setSlug] = useQueryState(
    "lugar",
    // `history: push` so back closes the drawer instead of leaving the map.
    parseAsString.withOptions({ history: "push", shallow: true }),
  );
  // Chosen categories ride in the URL too, so a filtered view is as shareable
  // as a single place: "mira el mapa con solo balnearios y salud".
  const [categoryIds, setCategoryIds] = useQueryState(
    "cat",
    parseAsArrayOf(parseAsString)
      .withDefault([])
      .withOptions({ shallow: true }),
  );
  // On by default: which roads are moving is the first thing anyone opening a
  // map of their own town looks for.
  const [traffic, setTraffic] = useQueryState(
    "transito",
    parseAsBoolean.withDefault(true).withOptions({ shallow: true }),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [flyTo, setFlyTo] = useState<{ lng: number; lat: number } | null>(null);

  const handleSelect = useCallback(
    (place: { id: string; slug: string } | null) => {
      setSelectedId(place?.id ?? null);
      void setSlug(place?.slug ?? null);
    },
    [setSlug],
  );

  const close = useCallback(() => {
    setSelectedId(null);
    void setSlug(null);
  }, [setSlug]);

  return (
    <>
      <CitizenMap
        selectedId={selectedId}
        categoryIds={categoryIds}
        flyTo={flyTo}
        traffic={traffic}
        onSelect={handleSelect}
      />

      {/* One row, laid out here rather than by each control positioning itself
          absolutely — which is how they ended up stacked on top of each other.
          Below the header, inset from both edges, and capped on wide screens so
          the search field does not stretch across a desktop. */}
      <div className="absolute inset-x-3 top-[4.5rem] z-20 flex items-center gap-2 md:max-w-md">
        <MapSearch
          onSelect={(target: SearchTarget) => {
            // A new object every time, so choosing the same result twice still
            // moves the map instead of being skipped as unchanged.
            setFlyTo({ lng: target.lng, lat: target.lat });
            void setSlug(target.slug ?? null);
          }}
        />
        <TrafficToggle
          enabled={traffic}
          // `null` clears the parameter rather than writing ?transito=true,
          // so the default state leaves a clean URL.
          onChange={(next) => void setTraffic(next ? null : false)}
        />
        <CategoryFilter
          selected={categoryIds}
          onChange={(next) =>
            void setCategoryIds(next.length > 0 ? next : null)
          }
        />
      </div>

      <PlaceDrawer slug={slug} onClose={close} />
    </>
  );
}
