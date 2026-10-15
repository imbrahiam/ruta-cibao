"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Footprints, MessagesSquare } from "lucide-react";
import { useTranslations } from "next-intl";
import { parseAsBoolean, parseAsString, useQueryState } from "nuqs";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useRealtime } from "@/hooks/use-realtime";
import { Link } from "@/i18n/navigation";
import { orpc } from "@/lib/orpc";
import type { CommunityFeature } from "@/modules/routes/map-features";
import { LayerRow } from "./layer-row";
import type { CitizenMapProps } from "./types";

export function useCommunityMap(
  bounds: { west: number; east: number; south: number; north: number },
  onFocus: (position: NonNullable<CitizenMapProps["flyTo"]>) => void,
) {
  const t = useTranslations("routes");
  const [routes, setRoutes] = useQueryState(
    "rutas",
    parseAsBoolean.withDefault(true),
  );
  const [cases, setCases] = useQueryState(
    "casos",
    parseAsBoolean.withDefault(true),
  );
  const [routeId, setRouteId] = useQueryState(
    "ruta",
    parseAsString.withOptions({ history: "push" }),
  );
  const [caseSlug, setCaseSlug] = useQueryState(
    "caso",
    parseAsString.withOptions({ history: "push" }),
  );
  const queryClient = useQueryClient();
  const query = useQuery({
    ...orpc.routes.map.queryOptions({ input: bounds }),
    enabled: routes || cases,
  });
  const route = useQuery({
    ...orpc.routes.detail.queryOptions({ input: { id: routeId ?? "" } }),
    enabled: !!routeId,
    retry: false,
  });
  const consultation = useQuery({
    ...orpc.consultations.detail.queryOptions({
      input: { slug: caseSlug ?? "" },
    }),
    enabled: !!caseSlug,
    retry: false,
  });
  useRealtime({
    channels: ["routes", "consultations"],
    onEvent: () => {
      void queryClient.invalidateQueries({ queryKey: orpc.routes.key() });
      void queryClient.invalidateQueries({
        queryKey: orpc.consultations.key(),
      });
    },
  });
  const first = route.data?.path[0];
  const location = consultation.data?.location;
  useEffect(() => {
    if (routeId && first) onFocus({ ...first, zoom: 13 });
  }, [routeId, first, onFocus]);
  useEffect(() => {
    if (caseSlug && location) onFocus({ ...location, zoom: 16 });
  }, [caseSlug, location, onFocus]);
  const features = (query.data?.features ?? []).filter((feature) =>
    feature.kind === "route" ? routes : cases,
  );
  if (
    routeId &&
    route.data &&
    first &&
    !features.some((feature) => feature.id === routeId)
  )
    features.push({
      id: routeId,
      kind: "route",
      title: route.data.name,
      lng: first.lng,
      lat: first.lat,
      color: "#166534",
      path: route.data.path,
      href: `/rutas?ruta=${routeId}`,
    });
  if (
    caseSlug &&
    consultation.data &&
    location &&
    !features.some((feature) => feature.id === caseSlug)
  )
    features.push({
      id: caseSlug,
      kind: "consultation",
      title: consultation.data.title,
      ...location,
      color: consultation.data.categoryColor,
      path: null,
      href: `/consultas/${caseSlug}`,
    });
  const selected = routeId ? route : consultation;
  return {
    features,
    select(feature: CommunityFeature) {
      void setRouteId(feature.kind === "route" ? feature.id : null);
      void setCaseSlug(feature.kind === "consultation" ? feature.id : null);
    },
    controls: (
      <div className="flex flex-col gap-1 px-4">
        <LayerRow
          icon={Footprints}
          title={t("showRoutes")}
          hint={t("showRoutesHint")}
          checked={routes}
          onCheckedChange={(value) => void setRoutes(value)}
        >
          <Link
            href="/rutas"
            className="inline-flex min-h-11 items-center font-medium text-primary text-[15px] underline-offset-4 hover:underline"
          >
            {t("seeAllRoutes")}
          </Link>
        </LayerRow>
        <LayerRow
          icon={MessagesSquare}
          title={t("showCases")}
          hint={t("showCasesHint")}
          checked={cases}
          onCheckedChange={(value) => void setCases(value)}
        >
          <Link
            href="/consultas"
            className="inline-flex min-h-11 items-center font-medium text-primary text-[15px] underline-offset-4 hover:underline"
          >
            {t("seeAllCases")}
          </Link>
        </LayerRow>
        {query.isError && (
          <p role="alert" className="px-3 text-sm">
            {t("mapError")}
          </p>
        )}
        {query.data?.truncated && (
          <p className="px-3 text-muted-foreground text-sm">
            {t("zoomForMore")}
          </p>
        )}
      </div>
    ),
    panel: (
      <Drawer
        open={!!routeId || !!caseSlug}
        onOpenChange={(open) => {
          if (!open) {
            void setRouteId(null);
            void setCaseSlug(null);
          }
        }}
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>
              {routeId
                ? (route.data?.name ?? t("details"))
                : (consultation.data?.title ?? t("showCases"))}
            </DrawerTitle>
            <DrawerDescription>
              {routeId
                ? route.data?.municipalityName
                : consultation.data?.municipalityName}
            </DrawerDescription>
          </DrawerHeader>
          <div className="space-y-4 overflow-y-auto px-5 pb-8">
            {selected.isPending && <p role="status">{t("loading")}</p>}
            {selected.isError && <p role="alert">{t("mapError")}</p>}
            {routeId && route.data && (
              <>
                <p className="whitespace-pre-line text-sm leading-relaxed">
                  {route.data.description}
                </p>
                <p className="font-medium">
                  {t(`difficulty.${route.data.difficulty}`)} ·{" "}
                  {t("minutes", { count: route.data.durationMinutes })} ·{" "}
                  {(route.data.distanceMeters / 1000).toFixed(1)} {t("km")}
                </p>
                <p className="text-sm">
                  {route.data.services
                    .map((service) => t(`services.${service}`))
                    .join(" · ") || t("noServices")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("safetyHint")}
                </p>
              </>
            )}
            {caseSlug && consultation.data && (
              <>
                <p className="line-clamp-5 text-sm leading-relaxed">
                  {consultation.data.body}
                </p>
                <Button
                  nativeButton={false}
                  render={<Link href={`/consultas/${caseSlug}`} />}
                >
                  {t("viewCase")}
                </Button>
              </>
            )}
            <Button
              variant="outline"
              onClick={() => {
                void setRouteId(null);
                void setCaseSlug(null);
              }}
            >
              {t("close")}
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    ),
  };
}
