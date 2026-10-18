"use client";

import {
  CloudDownload,
  Footprints,
  MessagesSquare,
  Monitor,
  Moon,
  Sun,
  TrafficCone,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { type ReactNode, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Sheet } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { publicEnv } from "@/lib/env.public";
import {
  basemapSizeBytes,
  basemapStorageSupported,
  formatMegabytes,
  isBasemapSaved,
  removeBasemap,
  saveBasemap,
  storableBasemapUrl,
} from "@/lib/offline/basemap";

export type MapLayers = { traffic: boolean; routes: boolean; cases: boolean };

export const DEFAULT_LAYERS: MapLayers = {
  traffic: true,
  routes: true,
  cases: false,
};

export function LayersSheet({
  open,
  onOpenChange,
  layers,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  layers: MapLayers;
  onChange: (next: MapLayers) => void;
}) {
  const t = useTranslations("map.layers");
  const { theme, setTheme } = useTheme();

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t("title")}>
      <ul className="divide-y divide-line/60 rounded-card bg-paper-2">
        <LayerRow
          icon={<TrafficCone strokeWidth={1.5} />}
          title={t("traffic")}
          body={t("trafficHint")}
          checked={layers.traffic}
          onChange={(value) => onChange({ ...layers, traffic: value })}
        />
        <LayerRow
          icon={<Footprints strokeWidth={1.5} />}
          title={t("routes")}
          body={t("routesHint")}
          checked={layers.routes}
          onChange={(value) => onChange({ ...layers, routes: value })}
        />
        <LayerRow
          icon={<MessagesSquare strokeWidth={1.5} />}
          title={t("cases")}
          body={t("casesHint")}
          checked={layers.cases}
          onChange={(value) => onChange({ ...layers, cases: value })}
        />
      </ul>

      <h3 className="t-label mt-6 mb-2.5 text-ink-3">{t("appearance")}</h3>
      <Segmented
        label={t("appearance")}
        value={(theme as "system" | "light" | "dark") ?? "system"}
        onChange={setTheme}
        className="w-full"
        options={[
          { value: "system", label: t("system") },
          { value: "light", label: t("light") },
          { value: "dark", label: t("dark") },
        ]}
      />
      <p className="t-small mt-2 flex items-center gap-1.5 text-ink-3">
        {theme === "dark" ? (
          <Moon className="size-3.5" />
        ) : theme === "light" ? (
          <Sun className="size-3.5" />
        ) : (
          <Monitor className="size-3.5" />
        )}
        {t("appearanceHint")}
      </p>

      <OfflineMap />
    </Sheet>
  );
}

function LayerRow({
  icon,
  title,
  body,
  checked,
  onChange,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <li>
      <label className="flex cursor-pointer items-center gap-3 px-4 py-3.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-card text-ink-2 shadow-ring [&_svg]:size-[18px]">
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] text-ink">{title}</span>
          <span className="t-small block text-ink-3">{body}</span>
        </span>
        <Switch
          checked={checked}
          onCheckedChange={onChange}
          aria-label={title}
        />
      </label>
    </li>
  );
}

/**
 * The province's map, kept on the phone. The whole PMTiles file goes into
 * Cache Storage and the service worker answers the map's range requests from
 * it, so the map keeps drawing with no signal. The size is shown before
 * anything is downloaded.
 */
function OfflineMap() {
  const t = useTranslations("map.layers.offline");
  const url = storableBasemapUrl(publicEnv.NEXT_PUBLIC_BASEMAP_PMTILES_URL);
  const [state, setState] = useState<
    "unknown" | "saved" | "absent" | "saving" | "unsupported"
  >("unknown");
  const [size, setSize] = useState<number | null>(null);

  useEffect(() => {
    if (!url || !basemapStorageSupported() || !("serviceWorker" in navigator)) {
      setState("unsupported");
      return;
    }
    void isBasemapSaved(url).then((saved) =>
      setState(saved ? "saved" : "absent"),
    );
    void basemapSizeBytes(url)
      .then(setSize)
      .catch(() => setSize(null));
  }, [url]);

  if (state === "unsupported" || !url) return null;

  return (
    <section className="mt-6 rounded-card bg-paper-2 p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-card text-ink-2 shadow-ring">
          <CloudDownload strokeWidth={1.5} className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] text-ink">{t("title")}</p>
          <p className="t-small text-ink-3">
            {state === "saved"
              ? t("saved")
              : size
                ? t("hint", { size: formatMegabytes(size) })
                : t("hintNoSize")}
          </p>
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        {state === "saved" ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              await removeBasemap(url);
              setState("absent");
            }}
          >
            {t("remove")}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="primary"
            disabled={state === "saving"}
            onClick={async () => {
              setState("saving");
              try {
                await saveBasemap(url);
                setState("saved");
                toast.success({ title: t("done") });
              } catch {
                setState("absent");
                toast.error({ title: t("failed") });
              }
            }}
          >
            {state === "saving" ? t("saving") : t("save")}
          </Button>
        )}
      </div>
    </section>
  );
}
