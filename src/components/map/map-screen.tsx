"use client";

import { parseAsArrayOf, parseAsString, useQueryState } from "nuqs";
import { useCallback, useState } from "react";
import { CategoryFilter } from "@/components/map/category-filter";
import { CitizenMap } from "@/components/map/citizen-map";
import { MapSearch, type SearchTarget } from "@/components/map/map-search";
import { PlaceDrawer } from "@/components/map/place-drawer";

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
        onSelect={handleSelect}
      />

      <MapSearch
        onSelect={(target: SearchTarget) => {
          // A new object every time, so choosing the same result twice still
          // moves the map instead of being skipped as unchanged.
          setFlyTo({ lng: target.lng, lat: target.lat });
          void setSlug(target.slug ?? null);
        }}
      />
      <CategoryFilter
        selected={categoryIds}
        onChange={(next) => void setCategoryIds(next.length > 0 ? next : null)}
      />
      <PlaceDrawer slug={slug} onClose={close} />
    </>
  );
}
