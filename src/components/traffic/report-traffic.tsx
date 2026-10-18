"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { FeatureCollection } from "geojson";
import type { MapLayerMouseEvent } from "maplibre-gl";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-context";
import { useMapContext, useMapLayers } from "@/components/map/map-core";
import { type PickCenter, PickFrame } from "@/components/map/pick-frame";
import { CategoryIcon } from "@/components/places/category-icon";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { Sheet } from "@/components/ui/sheet";
import { toast } from "@/components/ui/toast";
import { useBoundaries } from "@/hooks/use-boundaries";
import { cx } from "@/lib/cx";
import { errorReason } from "@/lib/errors";
import { municipalityAt } from "@/lib/map/boundaries";
import { STREET_ZOOM } from "@/lib/map/config";
import { MAP_PALETTES } from "@/lib/map/palette";
import {
  DEFAULT_STREET_EXTENT,
  type StreetExtent,
} from "@/lib/map/road-geometry";
import { newIdempotencyKey, sendOrQueue } from "@/lib/offline/submit";
import { client, orpc } from "@/lib/orpc";

const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] };
type Street = NonNullable<
  Awaited<ReturnType<typeof client.traffic.streetAt>>["street"]
>;

/**
 * Reporting the road. The crosshair asks one question (which road is this?)
 * and the map shades the answer; every road in view is drawn as a faint band
 * that is both a hint and a tap target. Then one required choice, one
 * optional sentence, one button. It is filled in at the side of a road,
 * often one-handed, so it is short on purpose.
 *
 * The browser never sends the road's shape: only where the crosshair was and
 * which road was meant. The server looks the street up again.
 */
export function ReportTraffic({
  onDone,
  onCancel,
}: {
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("traffic.report");
  const { map, theme } = useMapContext();
  const { viewer } = useAuth();
  const { data: boundaries } = useBoundaries();
  const queryClient = useQueryClient();
  const p = MAP_PALETTES[theme];
  const [center, setCenter] = useState<PickCenter | null>(null);
  const [extent, setExtent] = useState<StreetExtent>(DEFAULT_STREET_EXTENT);
  const [shape, setShape] = useState<"street" | "point">("street");
  const [preferredRoad, setPreferredRoad] = useState<string | undefined>();
  const [step, setStep] = useState<"pick" | "details">("pick");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const observedAt = useRef(new Date().toISOString());

  const atStreetZoom = (center?.zoom ?? 0) >= STREET_ZOOM;
  const where = center ? municipalityAt(center, boundaries) : null;

  const box = useMemo(() => {
    if (!map || !center || !atStreetZoom) return null;
    const bounds = map.getBounds();
    return {
      west: bounds.getWest(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      north: bounds.getNorth(),
    };
  }, [map, center, atStreetZoom]);

  const streets = useQuery({
    ...orpc.traffic.streetsInView.queryOptions({
      input: {
        ...(box ?? { west: 0, south: 0, east: 1, north: 1 }),
        limit: 250,
      },
    }),
    enabled: box !== null,
    placeholderData: (previous) => previous,
  });

  const lookup = useQuery({
    ...orpc.traffic.streetAt.queryOptions({
      input: {
        lng: center?.lng ?? 0,
        lat: center?.lat ?? 0,
        extentMeters: extent,
        roadId: preferredRoad,
      },
    }),
    enabled: Boolean(center && atStreetZoom && shape === "street"),
    placeholderData: (previous) => previous,
  });
  const street: Street | null =
    shape === "street" && atStreetZoom ? (lookup.data?.street ?? null) : null;
  const roadsAvailable = lookup.data?.available ?? true;

  const bands = useMemo<FeatureCollection>(
    () =>
      atStreetZoom && shape === "street"
        ? {
            type: "FeatureCollection",
            features: (streets.data?.streets ?? []).map((road) => ({
              type: "Feature",
              properties: { id: road.id },
              geometry: {
                type: "LineString",
                coordinates: road.path.map((point) => [point.lng, point.lat]),
              },
            })),
          }
        : EMPTY,
    [streets.data, atStreetZoom, shape],
  );

  const chosen = useMemo<FeatureCollection>(
    () =>
      street
        ? {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                properties: { role: "line" },
                geometry: {
                  type: "LineString",
                  coordinates: street.path.map((point) => [
                    point.lng,
                    point.lat,
                  ]),
                },
              },
              ...[street.path[0], street.path[street.path.length - 1]]
                .filter((point) => point !== undefined)
                .map((point) => ({
                  type: "Feature" as const,
                  properties: { role: "cap" },
                  geometry: {
                    type: "Point" as const,
                    coordinates: [point.lng, point.lat],
                  },
                })),
            ],
          }
        : EMPTY,
    [street],
  );

  useMapLayers({
    id: "pick-roads",
    source: { type: "geojson", data: EMPTY },
    data: bands,
    layers: [
      {
        id: "pick-roads-band",
        type: "line",
        source: "pick-roads",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": p.ink,
          "line-opacity": 0.045,
          "line-width": ["interpolate", ["linear"], ["zoom"], 13, 10, 17, 22],
        },
      },
    ],
  });

  useMapLayers({
    id: "pick-street",
    source: { type: "geojson", data: EMPTY },
    data: chosen,
    layers: [
      {
        id: "pick-street-casing",
        type: "line",
        source: "pick-street",
        filter: ["==", ["get", "role"], "line"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": p.card,
          "line-width": ["interpolate", ["linear"], ["zoom"], 13, 7, 17, 15],
        },
      },
      {
        id: "pick-street-line",
        type: "line",
        source: "pick-street",
        filter: ["==", ["get", "role"], "line"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": p.ink,
          "line-width": ["interpolate", ["linear"], ["zoom"], 13, 3.5, 17, 9],
        },
      },
      {
        id: "pick-street-caps",
        type: "circle",
        source: "pick-street",
        filter: ["==", ["get", "role"], "cap"],
        paint: {
          "circle-radius": 5,
          "circle-color": p.card,
          "circle-stroke-color": p.ink,
          "circle-stroke-width": 2.5,
        },
      },
    ],
  });

  // Tapping a band moves that road under the crosshair and says which one was meant.
  useEffect(() => {
    if (!map) return;
    const onClick = (event: MapLayerMouseEvent) => {
      const id = event.features?.[0]?.properties?.id;
      if (typeof id === "string") setPreferredRoad(id);
      map.easeTo({ center: event.lngLat, duration: 350 });
    };
    const enter = () => {
      map.getCanvas().style.cursor = "pointer";
    };
    const leave = () => {
      map.getCanvas().style.cursor = "";
    };
    map.on("click", "pick-roads-band", onClick);
    map.on("mouseenter", "pick-roads-band", enter);
    map.on("mouseleave", "pick-roads-band", leave);
    return () => {
      map.off("click", "pick-roads-band", onClick);
      map.off("mouseenter", "pick-roads-band", enter);
      map.off("mouseleave", "pick-roads-band", leave);
    };
  }, [map]);

  const categories = useQuery(orpc.traffic.categories.queryOptions());

  const canContinue =
    where?.state !== "outside" &&
    (shape === "point" ? Boolean(center) : Boolean(street));

  const submit = async () => {
    if (!center || !categoryId || !viewer?.userId) return;
    setBusy(true);
    setError(null);
    const requestId = newIdempotencyKey();
    const input = {
      roadId: shape === "street" ? street?.roadId : undefined,
      extentMeters: extent,
      observedAt: observedAt.current,
      requestId,
      categoryId,
      location: { lng: center.lng, lat: center.lat },
      shape,
      description: description.trim() || undefined,
    };
    try {
      const outcome = await sendOrQueue({
        procedure: "traffic.report",
        input,
        userId: viewer.userId,
        idempotencyKey: requestId,
        labelKey: "pending.labels.traffic",
        send: () => client.traffic.report(input),
      });
      toast.success({
        title: outcome.queued ? t("queued") : t("sent"),
        description: outcome.queued ? undefined : t("sentHint"),
      });
      await queryClient.invalidateQueries({ queryKey: orpc.traffic.key() });
      onDone();
    } catch (caught) {
      const reason = errorReason(caught);
      setError(t(`errors.${reason ?? "unknown"}` as "errors.unknown"));
    } finally {
      setBusy(false);
    }
  };

  const status = !center
    ? t("moveMap")
    : where?.state === "outside"
      ? t("outside")
      : shape === "point"
        ? t("pointHere", { municipality: where?.municipality?.name ?? "" })
        : !atStreetZoom
          ? t("zoomIn")
          : !roadsAvailable
            ? t("noNetwork")
            : street
              ? (street.name ?? t("unnamed"))
              : lookup.isFetching
                ? t("looking")
                : t("noStreet");

  return (
    <>
      <PickFrame
        marker="cross"
        minZoom={STREET_ZOOM + 1.5}
        onCenter={setCenter}
        card={
          <div>
            <p className="t-label text-ink-3">{t("eyebrow")}</p>
            <p
              className="mt-1.5 text-[17px] leading-snug font-medium tracking-[-0.012em] text-ink"
              aria-live="polite"
            >
              {status}
            </p>
            {shape === "street" && street ? (
              <p className="t-small mt-0.5 text-ink-2">{t("streetHint")}</p>
            ) : null}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {shape === "street" ? (
                <Segmented
                  label={t("extent")}
                  value={String(extent)}
                  onChange={(value) => setExtent(Number(value) as StreetExtent)}
                  options={[
                    { value: "150", label: "150 m" },
                    { value: "500", label: "500 m" },
                    { value: "2000", label: "2 km" },
                  ]}
                />
              ) : null}
              <button
                type="button"
                onClick={() =>
                  setShape(shape === "street" ? "point" : "street")
                }
                className="press rounded-full px-3 py-2 text-[14px] text-accent hover:bg-accent-soft"
              >
                {shape === "street" ? t("usePoint") : t("useStreet")}
              </button>
            </div>
            <div className="mt-4 flex gap-2">
              <Button variant="ghost" onClick={onCancel}>
                {t("cancel")}
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                disabled={!canContinue}
                onClick={() => setStep("details")}
              >
                {t("continue")}
              </Button>
            </div>
          </div>
        }
      />
      <Sheet
        open={step === "details"}
        onOpenChange={(open) => !open && setStep("pick")}
        title={t("detailsTitle")}
        description={street?.name ?? where?.municipality?.name ?? undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setStep("pick")}>
              {t("back")}
            </Button>
            <Button
              variant="accent"
              disabled={!categoryId || busy}
              onClick={submit}
            >
              {busy ? t("sending") : t("submit")}
            </Button>
          </>
        }
      >
        <fieldset>
          <legend className="t-label mb-2.5 text-ink-3">{t("what")}</legend>
          <div className="grid grid-cols-2 gap-2">
            {(categories.data ?? []).map((category) => {
              const on = categoryId === category.id;
              return (
                <label
                  key={category.id}
                  className={cx(
                    "flex min-h-[72px] cursor-pointer flex-col justify-between gap-2 rounded-card p-3 text-[15px] leading-snug transition-[background-color,box-shadow] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent",
                    on
                      ? "bg-accent-soft shadow-[0_0_0_1.5px_var(--accent)]"
                      : "bg-card shadow-ring hover:bg-paper-2",
                  )}
                >
                  <input
                    type="radio"
                    name="traffic-category"
                    className="sr-only"
                    checked={on}
                    onChange={() => setCategoryId(category.id)}
                  />
                  <span
                    className="flex size-7 items-center justify-center rounded-[9px] text-white"
                    style={{ backgroundColor: category.color }}
                  >
                    <CategoryIcon
                      icon={category.icon}
                      className="size-4"
                      strokeWidth={2}
                    />
                  </span>
                  {category.name}
                </label>
              );
            })}
          </div>
        </fieldset>
        <Field
          className="mt-5"
          htmlFor="traffic-description"
          label={t("description")}
          optional={t("optional")}
          hint={t("descriptionHint")}
          error={error ?? undefined}
        >
          <Textarea
            id="traffic-description"
            value={description}
            maxLength={280}
            onChange={(event) => setDescription(event.target.value)}
            className="min-h-20"
          />
        </Field>
      </Sheet>
    </>
  );
}
