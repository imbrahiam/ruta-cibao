"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useMapContext } from "./map-core";

export type PickCenter = { lng: number; lat: number; zoom: number };

/**
 * Choosing a spot the way ride and map apps do: the pin stays put and the map
 * moves under it. The card that explains the choice sits at the bottom on a
 * phone and in the left column on a desktop, and the map's padding is set to
 * match, so "the centre of the map" is the centre of what is still visible,
 * which is exactly where the crosshair is drawn.
 */
export function PickFrame({
  card,
  onCenter,
  marker = "pin",
  minZoom,
}: {
  card: ReactNode;
  onCenter: (center: PickCenter) => void;
  marker?: "pin" | "cross";
  /** Closes in to at least this zoom on arrival, in the same camera move. */
  minZoom?: number;
}) {
  const { map } = useMapContext();
  const desktop = useMediaQuery("(min-width: 50.625rem)");
  const cardRef = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState({ top: 0, bottom: 0, left: 0 });
  const [moving, setMoving] = useState(false);
  const onCenterRef = useRef(onCenter);
  onCenterRef.current = onCenter;

  useEffect(() => {
    if (!map || !cardRef.current) return;
    const element = cardRef.current;
    const measure = () => {
      const top = desktop ? 0 : 128;
      const bottom = desktop ? 0 : element.offsetHeight + 16;
      const left = desktop ? 432 : 0;
      setFrame({ top, bottom, left });
      const closer = minZoom !== undefined && map.getZoom() < minZoom;
      map.easeTo({
        padding: { top, bottom, left, right: 0 },
        ...(closer ? { zoom: minZoom } : {}),
        duration: closer ? 700 : 300,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => {
      observer.disconnect();
      map.easeTo({
        padding: { top: 0, bottom: 0, left: 0, right: 0 },
        duration: 300,
      });
    };
  }, [map, desktop, minZoom]);

  useEffect(() => {
    if (!map) return;
    const report = () => {
      const center = map.getCenter();
      onCenterRef.current({
        lng: center.lng,
        lat: center.lat,
        zoom: map.getZoom(),
      });
    };
    const start = () => setMoving(true);
    const end = () => {
      setMoving(false);
      report();
    };
    map.on("movestart", start);
    map.on("moveend", end);
    report();
    return () => {
      map.off("movestart", start);
      map.off("moveend", end);
    };
  }, [map]);

  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute z-20 -translate-x-1/2"
        style={{
          left: `calc(${frame.left}px + (100% - ${frame.left}px) / 2)`,
          top: `calc(${frame.top}px + (100% - ${frame.top + frame.bottom}px) / 2)`,
        }}
      >
        {marker === "pin" ? (
          <span className="relative -mt-[46px] flex flex-col items-center">
            <span
              className="flex size-9 items-center justify-center rounded-full bg-accent shadow-lg ring-[3px] ring-card transition-transform duration-200 ease-out"
              style={{ transform: moving ? "translateY(-8px)" : undefined }}
            >
              <span className="size-2.5 rounded-full bg-on-accent" />
            </span>
            <span className="h-3 w-0.5 rounded-full bg-accent" />
            <span
              className="mt-0.5 h-1.5 w-3 rounded-[50%] bg-accent/25 blur-[1px] transition-transform duration-200"
              style={{ transform: moving ? "scale(0.7)" : undefined }}
            />
          </span>
        ) : (
          <span className="relative -mt-4 flex size-8 items-center justify-center">
            <span className="absolute h-8 w-0.5 rounded-full bg-ink" />
            <span className="absolute h-0.5 w-8 rounded-full bg-ink" />
            <span className="size-3 rounded-full bg-card ring-2 ring-ink" />
          </span>
        )}
      </div>
      <div
        ref={cardRef}
        className="pointer-events-auto absolute inset-x-3 bottom-[max(12px,env(safe-area-inset-bottom))] z-30 animate-panel md:inset-x-auto md:top-[88px] md:bottom-auto md:left-4 md:w-[400px]"
      >
        <div className="rounded-panel bg-card p-5 shadow-lg">{card}</div>
      </div>
    </>
  );
}
