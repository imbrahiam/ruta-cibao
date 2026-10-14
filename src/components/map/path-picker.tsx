"use client";

import { LocateFixed, MapPin, Undo2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CitizenMap } from "@/components/map/citizen-map";
import { MapProvider } from "@/components/map/map-provider";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  type LocationProblem,
  primePosition,
  requestPosition,
} from "@/lib/geolocation";
import { PROVINCE_CENTER } from "@/lib/map/config";

type Position = { lng: number; lat: number };
export function PathPicker({
  points,
  onChange,
  single = false,
}: {
  points: Position[];
  onChange: (points: Position[]) => void;
  single?: boolean;
}) {
  const t = useTranslations("routes");
  const locationCopy = useTranslations("location");
  const [center, setCenter] = useState<Position>({
    lng: PROVINCE_CENTER.longitude,
    lat: PROVINCE_CENTER.latitude,
  });
  const [flyTo, setFlyTo] = useState<(Position & { zoom: number }) | null>(
    null,
  );
  const [locating, setLocating] = useState(false);

  // Warms a fix that was already granted, so the button below answers at once
  // rather than after a cold GPS search. It never prompts on its own.
  useEffect(primePosition, []);

  /**
   * Where the problem is, taken from the phone.
   *
   * Dragging the province-wide map onto your own street is the slow way to
   * answer a question the device can answer instantly, and somebody opening a
   * case about a broken light is usually standing under it. This is not the
   * verified claim the place form makes — a case records where the problem is,
   * not who was there — so it is open to anyone.
   */
  function findMe() {
    setLocating(true);

    // Nothing awaited before the request: Safari drops the permission prompt
    // if the gesture is already a tick old.
    void requestPosition().then((result) => {
      setLocating(false);

      if (!result.ok) {
        toast.error(locationCopy(result.problem satisfies LocationProblem));
        return;
      }

      setFlyTo({ ...result.position, zoom: 16 });
      onChange(single ? [result.position] : [...points, result.position]);
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {t(single ? "pointHint" : "drawHint")}
      </p>
      <div className="relative isolate h-72 overflow-hidden rounded-2xl border md:h-96">
        <MapProvider>
          <CitizenMap
            selectedId={null}
            categoryIds={[]}
            flyTo={flyTo}
            onSelect={() => {}}
            pickingLocation
            onViewportChange={setCenter}
            draftPath={single ? null : points}
            searchMarker={
              single && points[0]
                ? { ...points[0], label: t("location") }
                : null
            }
          />
        </MapProvider>
        <MapPin
          className="pointer-events-none absolute left-1/2 top-1/2 z-10 size-8 -translate-x-1/2 -translate-y-full fill-background text-primary drop-shadow"
          aria-hidden
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          onClick={() => onChange(single ? [center] : [...points, center])}
          disabled={!single && points.length >= 500}
        >
          {t(single ? "setPoint" : "addPoint")}
        </Button>
        <Button
          variant="outline"
          onClick={() => onChange(points.slice(0, -1))}
          disabled={points.length === 0}
        >
          <Undo2 aria-hidden />
          {t("undo")}
        </Button>
        <Button variant="ghost" onClick={findMe} disabled={locating}>
          {locating ? (
            <Spinner className="size-4" />
          ) : (
            <LocateFixed className="size-4" aria-hidden />
          )}
          {locating ? locationCopy("locating") : locationCopy("use")}
        </Button>
        <span className="text-sm text-muted-foreground" role="status">
          {t("points", { count: points.length })}
        </span>
      </div>
    </div>
  );
}
