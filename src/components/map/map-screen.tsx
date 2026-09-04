"use client";

import {
  parseAsArrayOf,
  parseAsBoolean,
  parseAsString,
  useQueryState,
} from "nuqs";
import { useCallback, useState } from "react";
import { CategoryChips } from "@/components/map/category-chips";
import { CitizenMap } from "@/components/map/citizen-map";
import { MapLayers } from "@/components/map/map-layers";
import { MapSearch, type SearchTarget } from "@/components/map/map-search";
import { PlaceDrawer } from "@/components/map/place-drawer";
import {
  DEFAULT_VIEW_MODE,
  VIEW_MODES,
  type ViewMode,
} from "@/lib/map/view-mode";

/**
 * The map screen.
 *
 * Every piece of state lives in the URL rather than in component state: which
 * place is open, which categories are on, how the ground is drawn, whether
 * traffic is shown. That makes any view shareable by pasting the address,
 * survivable across the reload a phone does when it drops signal, and closable
 * with the back button — the gesture people reach for before they look for a
 * close affordance.
 *
 * Defaults write no parameter, so a plain link stays clean.
 */
function asViewMode(value: string): ViewMode {
  // A value typed into the URL by hand can be anything.
  return VIEW_MODES.includes(value as ViewMode)
    ? (value as ViewMode)
    : DEFAULT_VIEW_MODE;
}

export function MapScreen() {
  const [slug, setSlug] = useQueryState(
    "lugar",
    // `history: push` so back closes the drawer instead of leaving the map.
    parseAsString.withOptions({ history: "push", shallow: true }),
  );
  const [categoryIds, setCategoryIds] = useQueryState(
    "cat",
    parseAsArrayOf(parseAsString)
      .withDefault([])
      .withOptions({ shallow: true }),
  );
  const [viewMode, setViewMode] = useQueryState(
    "vista",
    parseAsString.withDefault(DEFAULT_VIEW_MODE).withOptions({ shallow: true }),
  );
  const [traffic, setTraffic] = useQueryState(
    "transito",
    parseAsBoolean.withDefault(true).withOptions({ shallow: true }),
  );

  // The tile carries the feature id and the drawer needs the slug, so both are
  // kept: the slug in the URL because it is what a person would read, the id in
  // memory because it is what the map matches when highlighting the selection.
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
        viewMode={asViewMode(viewMode)}
        onSelect={handleSelect}
      />

      {/* Search and filters ride over the top of the map rather than above it,
          so the map keeps the full height of the screen. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col gap-2 p-3">
        {/* Room on the right for the account cluster, which only exists
            on small screens where there is no rail. */}
        <div className="pointer-events-auto flex items-start gap-2 pr-28 md:pr-0">
          <MapSearch
            onSelect={(target: SearchTarget) => {
              // A new object every time, so choosing the same result twice
              // still moves the map instead of being skipped as unchanged.
              setFlyTo({ lng: target.lng, lat: target.lat });
              void setSlug(target.slug ?? null);
            }}
          />
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          <CategoryChips
            selected={categoryIds}
            onChange={(next) =>
              void setCategoryIds(next.length > 0 ? next : null)
            }
          />
        </div>
      </div>

      <MapLayers
        mode={asViewMode(viewMode)}
        traffic={traffic}
        onModeChange={(next) =>
          void setViewMode(next === DEFAULT_VIEW_MODE ? null : next)
        }
        onTrafficChange={(next) => void setTraffic(next ? null : false)}
      />

      <PlaceDrawer slug={slug} onClose={close} />
    </>
  );
}
