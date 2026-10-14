"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, HardDriveDownload, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { publicEnv } from "@/lib/env.public";
import { supportsVectorMap } from "@/lib/map/render-support";
import {
  basemapSizeBytes,
  basemapStorageSupported,
  formatMegabytes,
  isBasemapSaved,
  removeBasemap,
  saveBasemap,
  storableBasemapUrl,
} from "@/lib/offline/basemap";

/**
 * "Guardar el mapa para usar sin señal", as a row in the layers panel.
 *
 * Only offered where it can be honoured: the MapLibre renderer over a basemap
 * this origin serves. Google's map cannot be stored, so on that renderer the
 * row does not exist rather than existing greyed out with an explanation.
 */
export function OfflineBasemap() {
  const t = useTranslations("map.offlineBasemap");
  const queryClient = useQueryClient();
  const [vectorSupported, setVectorSupported] = useState(false);
  useEffect(() => {
    if (publicEnv.NEXT_PUBLIC_MAP_RENDERER === "maplibre")
      setVectorSupported(supportsVectorMap());
  }, []);
  const url =
    publicEnv.NEXT_PUBLIC_MAP_RENDERER === "maplibre" && vectorSupported
      ? storableBasemapUrl(publicEnv.NEXT_PUBLIC_BASEMAP_PMTILES_URL)
      : undefined;
  const supported = basemapStorageSupported();

  const saved = useQuery({
    queryKey: ["offline-basemap", "saved", url],
    queryFn: () => isBasemapSaved(url ?? ""),
    enabled: Boolean(url) && supported,
  });
  const size = useQuery({
    queryKey: ["offline-basemap", "size", url],
    queryFn: () => basemapSizeBytes(url ?? ""),
    enabled: Boolean(url) && supported && saved.data === false,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["offline-basemap", "saved"] });
  const save = useMutation({
    mutationFn: () => saveBasemap(url ?? ""),
    onSettled: invalidate,
  });
  const remove = useMutation({
    mutationFn: () => removeBasemap(url ?? ""),
    onSettled: invalidate,
  });

  if (!url || !supported) return null;

  const busy = save.isPending || remove.isPending;
  // The province is 9 MB; the whole country is 57. Past this the row says so.
  const large = (size.data ?? 0) >= 25_000_000;

  return (
    <div className="flex min-h-16 items-center gap-3 rounded-lg px-3 py-2">
      {saved.data ? (
        <Check className="size-5 shrink-0 text-emerald-600" aria-hidden />
      ) : (
        <HardDriveDownload
          className="size-5 shrink-0 text-muted-foreground"
          aria-hidden
        />
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-base">
          {saved.data ? t("savedTitle") : t("title")}
        </span>
        <span className="block text-muted-foreground text-xs leading-snug">
          {save.isError
            ? t("failed")
            : saved.data
              ? t("savedHint")
              : size.data
                ? t("hintWithSize", { size: formatMegabytes(size.data) })
                : t("hint")}
          {!saved.data && !save.isError && large && ` ${t("wifiHint")}`}
        </span>
      </span>
      {saved.data ? (
        <Button
          variant="ghost"
          size="icon"
          className="size-11 shrink-0"
          aria-label={t("remove")}
          disabled={busy}
          onClick={() => remove.mutate()}
        >
          {busy ? <Spinner className="size-4" /> : <Trash2 aria-hidden />}
        </Button>
      ) : (
        <Button
          variant="secondary"
          className="h-10 shrink-0"
          disabled={busy || saved.isPending}
          onClick={() => save.mutate()}
        >
          {busy ? <Spinner className="size-4" /> : null}
          {busy ? t("saving") : t("save")}
        </Button>
      )}
    </div>
  );
}
