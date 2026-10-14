"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, RotateCcw, TrafficCone } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/auth-context";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useBoundaries } from "@/hooks/use-boundaries";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useSignInHref } from "@/hooks/use-sign-in-href";
import { Link } from "@/i18n/navigation";
import { markInstallMoment } from "@/lib/install-moment";
import { municipalityAt } from "@/lib/map/boundaries";
import { categoryIcon } from "@/lib/map/category-icons";
import { readableOn } from "@/lib/map/marker-pin";
import type { Street, StreetExtent } from "@/lib/map/road-geometry";
import { enqueue, newIdempotencyKey } from "@/lib/offline/queue";
import { client, orpc } from "@/lib/orpc";
import { cn } from "@/lib/utils";

/**
 * Reporting something on the road.
 *
 * Shorter than the place form on purpose, and that is the whole design. This is
 * filled in at the side of a road, often one-handed, often by somebody who has
 * just stopped: one required choice, one optional sentence, one button. The
 * category carries the meaning, so the description can be empty and usually is.
 *
 * A visitor may file one. The tier matrix says so and it is right — the tourist
 * stuck behind the landslide knows what the residents on the far side need to
 * hear, and asking for a cédula first would throw that away.
 */
type NewTraffic = {
  roadId?: string;
  extentMeters?: StreetExtent;
  observedAt: string;
  street?: Street;
  lng: number;
  lat: number;
  /** Whether the report covers a stretch or a single point. */
  shape: "point" | "street";
};

function errorReason(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("data" in error)) return;
  const data = error.data;
  if (!data || typeof data !== "object" || !("reason" in data)) return;
  return typeof data.reason === "string" ? data.reason : undefined;
}

export function ReportTrafficDrawer({
  point,
  onClose,
  onPickAgain,
  onReported,
}: {
  point: NewTraffic | null;
  onClose: () => void;
  onPickAgain: () => void;
  onReported: () => void;
}) {
  const t = useTranslations("map.traffic");
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const signInHref = useSignInHref();
  const { data: categories = [] } = useQuery(
    orpc.traffic.categories.queryOptions(),
  );
  const { data: boundaries } = useBoundaries();
  const { viewer, isLoading: isLoadingViewer } = useAuth();

  const [categoryId, setCategoryId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const municipality = point
    ? municipalityAt(point, boundaries).municipality
    : null;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!point || !categoryId || !viewer?.userId) return;

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const requestId = newIdempotencyKey();
    const input = {
      roadId: point.roadId,
      extentMeters: point.extentMeters,
      observedAt: point.observedAt,
      requestId,
      categoryId,
      location: { lng: point.lng, lat: point.lat },
      shape: point.shape,
      description: String(form.get("description") ?? "") || undefined,
    };

    setSubmitting(true);
    setError(null);

    try {
      // The offline queue matters more here than anywhere else in the app: a
      // dead zone is exactly where the road is blocked, and the report is worth
      // sending late rather than not at all.
      if (!navigator.onLine) {
        await enqueue({
          procedure: "traffic.report",
          userId: viewer.userId,
          input,
          idempotencyKey: requestId,
          labelKey: "map.traffic.queued",
        });
        toast.success(t("queued"));
        markInstallMoment();
      } else {
        await client.traffic.report(input);
        toast.success(t("sent"));
        markInstallMoment();
      }

      formElement.reset();
      setCategoryId("");
      onReported();
      onClose();
    } catch (caught) {
      const reason = errorReason(caught);
      setError(
        reason === "duplicate"
          ? t("duplicate")
          : reason === "rate_limited"
            ? t("rateLimited")
            : reason === "outside_province"
              ? t("outsideProvince")
              : reason === "invalid_street"
                ? t("streetChanged")
                : reason === "stale_report"
                  ? t("staleReport")
                  : t("failed"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Drawer
      open={point !== null}
      onOpenChange={(open) => !open && onClose()}
      showSwipeHandle={!isDesktop}
      swipeDirection={isDesktop ? "right" : "down"}
    >
      <DrawerContent>
        <DrawerHeader className="border-b">
          <div className="flex items-start gap-3 text-left">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-600">
              <TrafficCone className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 space-y-1">
              <DrawerTitle className="text-lg">{t("reportTitle")}</DrawerTitle>
              <DrawerDescription className="text-pretty leading-relaxed">
                {t("reportDescription")}
              </DrawerDescription>
            </div>
          </div>
        </DrawerHeader>

        <div className="overflow-y-auto px-5 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {isLoadingViewer ? (
            <p
              className="flex min-h-32 items-center justify-center gap-2 text-muted-foreground text-sm"
              role="status"
            >
              <Spinner className="size-4" />
            </p>
          ) : viewer?.kind === "anonymous" ? (
            <div className="flex flex-col items-center gap-4 rounded-xl border bg-muted/40 p-6 text-center">
              <TrafficCone
                className="size-7 text-muted-foreground"
                aria-hidden
              />
              <div className="space-y-1">
                <p className="font-medium">{t("signInTitle")}</p>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {t("signInDescription")}
                </p>
              </div>
              <Button
                className="h-11 w-full"
                nativeButton={false}
                render={<Link href={signInHref} />}
              >
                {t("signInTitle")}
              </Button>
            </div>
          ) : (
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="flex items-center justify-between gap-3 rounded-xl border bg-muted/35 px-3 py-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <CheckCircle2
                    className="size-5 shrink-0 text-emerald-600"
                    aria-hidden
                  />
                  <span className="min-w-0">
                    {/* A street is described by what it is, not by a pair of
                        coordinates on it, which name nothing. The name gets
                        its own line so a long avenue is not cut off by the
                        figures beside it. */}
                    <span className="block truncate font-medium text-sm">
                      {point?.shape === "street" ? (
                        (point.street?.name ?? t("streetSelected"))
                      ) : (
                        <span className="font-mono">
                          {point?.lat.toFixed(5)}, {point?.lng.toFixed(5)}
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-muted-foreground text-xs">
                      {municipality?.name}
                      {point?.shape === "street" &&
                        ` · ${t("affects", { meters: point.street?.lengthMeters ?? 0 })}`}
                    </span>
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={t("adjustLocation")}
                  onClick={onPickAgain}
                >
                  <RotateCcw aria-hidden />
                </Button>
              </div>

              {/* One tap, not three. A select on a phone is open, scroll,
                  pick, close; the taxonomy here is a handful of rows the
                  municipality maintains, and each fits on a card with the
                  same icon and colour the map will draw it in. */}
              <fieldset className="space-y-2">
                <legend className="font-medium text-sm">{t("type")}</legend>
                <div
                  className={cn(
                    "grid gap-2",
                    categories.length <= 3 ? "grid-cols-3" : "grid-cols-2",
                  )}
                >
                  {categories.map((category) => {
                    const Icon = categoryIcon(category.icon);
                    const selected = category.id === categoryId;
                    return (
                      <button
                        key={category.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setCategoryId(category.id)}
                        className={cn(
                          "flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border px-2 py-3 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          selected
                            ? "border-foreground bg-accent/60"
                            : "hover:bg-muted/60",
                        )}
                      >
                        <span
                          className="flex size-10 items-center justify-center rounded-full"
                          style={{
                            backgroundColor: category.color,
                            color: readableOn(category.color),
                          }}
                        >
                          <Icon className="size-5" aria-hidden />
                        </span>
                        <span className="text-balance font-medium text-[13px] leading-tight">
                          {category.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <div className="space-y-2">
                <Label htmlFor="traffic-description">{t("details")}</Label>
                <Textarea
                  id="traffic-description"
                  name="description"
                  placeholder={t("detailsPlaceholder")}
                  maxLength={280}
                />
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {t("detailsHint")}
                </p>
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-lg bg-destructive/10 p-3 text-destructive text-sm"
                >
                  {error}
                </p>
              )}

              <Button
                type="submit"
                className="h-12 w-full text-base"
                disabled={submitting || !categoryId}
              >
                {submitting ? (
                  <Spinner className="size-5" />
                ) : (
                  <TrafficCone className="size-5" aria-hidden />
                )}
                {submitting ? t("sending") : t("submit")}
              </Button>
            </form>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
