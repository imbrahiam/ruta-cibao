"use client";

import { MapPin, Undo2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { CitizenMap } from "@/components/map/citizen-map";
import { MapProvider } from "@/components/map/map-provider";
import { Button } from "@/components/ui/button";
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
  const [center, setCenter] = useState<Position>({
    lng: PROVINCE_CENTER.longitude,
    lat: PROVINCE_CENTER.latitude,
  });
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
            flyTo={null}
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
          className="h-11"
          variant="secondary"
          onClick={() => onChange(single ? [center] : [...points, center])}
          disabled={!single && points.length >= 500}
        >
          {t(single ? "setPoint" : "addPoint")}
        </Button>
        <Button
          className="h-11"
          variant="outline"
          onClick={() => onChange(points.slice(0, -1))}
          disabled={points.length === 0}
        >
          <Undo2 aria-hidden />
          {t("undo")}
        </Button>
        <span className="text-sm text-muted-foreground" role="status">
          {t("points", { count: points.length })}
        </span>
      </div>
    </div>
  );
}
