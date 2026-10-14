"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Crosshair,
  LocateFixed,
  MapPin,
  Route,
  TrafficCone,
  TriangleAlert,
  ZoomIn,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useBoundaries } from "@/hooks/use-boundaries";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Link } from "@/i18n/navigation";
import {
  type LocationProblem,
  primePosition,
  requestPosition,
} from "@/lib/geolocation";
import { municipalityAt } from "@/lib/map/boundaries";
import { STREET_ZOOM } from "@/lib/map/config";
import { PIN_GEOMETRY } from "@/lib/map/marker-pin";
import { mapPalette } from "@/lib/map/palette";
import {
  type RoadAnchor,
  STREET_EXTENTS,
  type Street,
  type StreetExtent,
} from "@/lib/map/road-geometry";
import { CROSSHAIR_FRACTION } from "@/lib/map/viewport";
import { orpc } from "@/lib/orpc";
import { cn } from "@/lib/utils";

/**
 * Choosing where a new place goes.
 *
 * Two ways, and the difference between them is the point:
 *
 *   Drag the map under a fixed pin. Anyone signed in can do this, and it is
 *   how you add the clinic you know about but are not standing in front of.
 *
 *   "Estoy aquí ahora" takes the phone's own fix. Only a cédula-verified
 *   citizen may claim it, because it is a claim about a person: an identified
 *   neighbour standing at the spot. The server checks it too — the button
 *   being hidden is a courtesy, not the rule.
 *
 * Everything else on the map steps aside while this is open, so the only
 * decision on screen is the point.
 */
type Position = { lng: number; lat: number };

/**
 * The same pin the map draws, at the size a selected one gets.
 *
 * Real SVG rather than the data URI the markers use, so it can carry a
 * transition and the browser is not re-decoding an image on every frame while
 * the map is being dragged under it. The silhouette comes from the shared
 * geometry, so this is literally the same shape as every pin on the map — one
 * path, one rim, no seam at the shoulder.
 */
const PIN_SCALE = 1.25;

function DraftPin({ purpose }: { purpose: "place" | "traffic" }) {
  const { glyph, rim } = PIN_GEOMETRY;

  return (
    <svg
      width={PIN_GEOMETRY.width * PIN_SCALE}
      height={PIN_GEOMETRY.height * PIN_SCALE}
      viewBox={PIN_GEOMETRY.viewBox}
      className="block drop-shadow-lg"
      aria-hidden
    >
      <title>{""}</title>
      <path
        d={PIN_GEOMETRY.silhouette}
        fill={mapPalette.ink}
        stroke={rim.color}
        strokeWidth={rim.width}
        strokeLinejoin="round"
        paintOrder="stroke"
      />
      {/* The glyph says what the pin is for before the card does: a plus for
          a place, a cone for the road. Both sit in the same 24-unit box a
          lucide icon occupies, so the cone is the very icon the menu and the
          form use — nested as an SVG rather than copied as path data. */}
      <g
        transform={`translate(${glyph.translate}) scale(${glyph.scale})`}
        fill="none"
        stroke="#ffffff"
        strokeWidth={glyph.strokeWidth / glyph.scale}
        strokeLinecap="round"
      >
        {purpose === "traffic" ? (
          <TrafficCone
            width={24}
            height={24}
            stroke="#ffffff"
            strokeWidth={2.75}
            aria-hidden
          />
        ) : (
          <path d="M12 5v14M5 12h14" />
        )}
      </g>
    </svg>
  );
}

export function PickLocation({
  extentMeters,
  onExtentChange,
  onAnchorChange,
  aim,
  moving,
  purpose = "place",
  anchor,
  shape,
  onShapeChange,
  onCancel,
  onCenter,
  onConfirm,
  onDraftPathChange,
}: {
  extentMeters: StreetExtent;
  onExtentChange: (value: StreetExtent) => void;
  onAnchorChange: (value: RoadAnchor) => void;
  /**
   * What is under the crosshair, and how close the map is — the zoom decides
   * what can be tapped.
   */
  aim: Position & { zoom: number };
  moving: boolean;
  /** Traffic can be a stretch of road; a place is always one point. */
  purpose?: "place" | "traffic";
  /**
   * What the person is pointing at: the map's centre, or the spot they tapped.
   *
   * Separate from `aim` because a tap is a way of pointing that does not
   * move the map — and on a phone it is the most direct one there is.
   *
   * Null while a street is being chosen with a mouse and nothing has been
   * clicked yet: there is no crosshair on screen then, so nothing is being
   * pointed at and the card waits rather than picking a road on the person's
   * behalf.
   */
  anchor: RoadAnchor | null;
  /**
   * Whether a traffic report covers the street or one point of it.
   *
   * Held by the screen rather than here because the crosshair is unmounted
   * every time the form behind it opens, and coming back to adjust a report
   * should not silently change what it covers.
   */
  shape: "point" | "street";
  onShapeChange: (shape: "point" | "street") => void;
  onCancel: () => void;
  /** Moves the map to a coordinate without asserting anything about it. */
  onCenter: (position: Position) => void;
  onConfirm: (
    position: RoadAnchor,
    source: "map" | "gps",
    street?: Street,
  ) => void;
  /** Hands the road being shaded to the map, which draws it. */
  onDraftPathChange?: (path: Position[] | null) => void;
}) {
  const t = useTranslations("map.addPlace");
  const trafficCopy = useTranslations("map.traffic");
  const locationCopy = useTranslations("location");
  const { viewer } = useAuth();
  const { data: boundaries } = useBoundaries();
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [locating, setLocating] = useState<"center" | "here" | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // The first fix of a session is the slow one, and by the time somebody has
  // dragged the map onto the spot it has long been paid for. Only warms a
  // permission already granted — it never asks on its own.
  useEffect(primePosition, []);

  const markingStreet = purpose === "traffic" && shape === "street";
  /**
   * Whether the roads are close enough to be drawn as tappable bands.
   *
   * Below it the map draws no bands, and a person told to "toca una calle"
   * would be looking for something that is not there. Saying so beats leaving
   * them to work it out.
   */
  const streetsTappable = aim.zoom >= STREET_ZOOM;

  /**
   * Whether the crosshair is shown at all.
   *
   * A point always needs one — there is nothing on the map to aim at. Choosing
   * a *street* is different: with a mouse the road highlights under the pointer
   * and a click takes it, so a pin fixed to the centre of the screen is a
   * second way to do something already being done, sitting on top of the thing
   * it is competing with.
   *
   * A finger has no hover, so on a touch screen it stays: dragging the map
   * under a fixed pin is the one way to aim that does not require hitting a
   * 12-pixel band first.
   */
  const showCrosshair = !markingStreet || !isDesktop;
  /** Nothing pointed at yet, and no crosshair to point with. */
  const awaitingStreetClick =
    markingStreet && streetsTappable && anchor === null;

  /**
   * Whether the crosshair is still the thing being aimed.
   *
   * Tapping a street selects it without moving the map, so the pin at the
   * centre stops standing for the choice — it would be pointing at one road
   * while another is shaded. It fades rather than disappearing, because panning
   * has to keep working and an affordance that vanishes is one nobody finds
   * again.
   */
  const aimingWithCrosshair =
    anchor === null || (anchor.lng === aim.lng && anchor.lat === aim.lat);

  /**
   * The street under the crosshair.
   *
   * Debounced by the map rather than by a timer: `aim` is only reported
   * once the map settles, so this asks when somebody stops moving and never per
   * frame. The answer is cached here and on the server, so nudging back over a
   * road already seen costs nothing.
   */
  const streetQuery = useQuery({
    ...orpc.traffic.streetAt.queryOptions({
      input: {
        ...(anchor ?? aim),
        extentMeters,
      },
    }),
    // Not from the browse zoom. The crosshair opens over the province, and
    // whatever highway happens to run under it there is not a choice anybody
    // made — the card used to announce it as selected, with the button lit,
    // before the map had been touched.
    enabled: markingStreet && streetsTappable && anchor !== null && !moving,
    staleTime: 60000,
  });

  /**
   * The road the lookup last resolved, kept until another answer replaces it.
   *
   * Reading the choice straight off the query threw it away twice: the lookup
   * is disabled below `STREET_ZOOM` — on purpose, so panning the province-wide
   * map cannot select a road nobody aimed at — so pinching out to see where
   * the jam sits cleared the shading and greyed out the button, and every pan
   * blinked the shading off while the next answer was in flight. A choice
   * already made outlives both; only a new answer, including a definite "no
   * road here", takes it back.
   */
  const [chosenStreet, setChosenStreet] = useState<Street | null>(null);

  useEffect(() => {
    if (!markingStreet) {
      setChosenStreet(null);
      return;
    }
    if (streetQuery.isSuccess) {
      setChosenStreet(streetQuery.data?.street ?? null);
    }
  }, [markingStreet, streetQuery.isSuccess, streetQuery.data]);

  const street = markingStreet ? chosenStreet : null;
  /**
   * Only once the lookup has actually answered with nothing.
   *
   * `!isFetching` was wrong twice over: the query is disabled while the map is
   * moving and has not started on the first frame, and in both of those states
   * nothing is in flight either — so the warning appeared over a road the map
   * was about to find, every time somebody panned.
   */
  const noStreet =
    markingStreet && streetsTappable && streetQuery.isSuccess && !street;
  /**
   * No road network imported on this deployment.
   *
   * A different sentence from "no road here", because it is a different fact —
   * one about the place, one about us — and telling somebody standing on a
   * street that no street could be found is the version of this that makes the
   * map look broken.
   */
  const roadsUnavailable =
    markingStreet &&
    streetsTappable &&
    streetQuery.isSuccess &&
    streetQuery.data?.available === false;

  // The map draws the shading; this says what to shade.
  useEffect(() => {
    onDraftPathChange?.(street?.path ?? null);
  }, [street, onDraftPathChange]);

  // Leaving the crosshair must not leave a road shaded behind it.
  useEffect(() => () => onDraftPathChange?.(null), [onDraftPathChange]);

  // Tested against the real polygons, the same ones the map is drawing, so the
  // warning under the crosshair matches the line the person can see.
  //
  // Only a definite "outside" warns or blocks. While the polygons are still
  // loading the answer is `unknown`, and telling somebody standing in Sabaneta
  // that they are outside the province — then greying out the button — because
  // a 30 KB file has not arrived yet is the worst version of this screen.
  // The database checks the point on submit regardless.
  const located = municipalityAt(anchor ?? aim, boundaries);
  const municipality = located.municipality;
  const outside = located.state === "outside";
  const isCitizen = viewer?.kind === "citizen";
  // A phone's fix is a point, so it has nothing to offer while a street is
  // being chosen.
  const canUseGps = isCitizen && !markingStreet;
  /**
   * The invitation to verify, for the people it is actually for.
   *
   * It used to be the `else` of `canUseGps`, which meant a verified citizen
   * choosing a street — where the GPS button is hidden for its own reasons —
   * was told to go and verify a cédula they had already verified.
   */
  const showVerifyHint = !isCitizen && !markingStreet;

  /**
   * Two different things, and the difference matters.
   *
   * `center` moves the map to where the phone says you are. Anybody may do
   * that — it is navigation, not a claim, and it is the fastest way for someone
   * standing at the place to get the crosshair onto it.
   *
   * `here` additionally asserts the coordinate came from the phone's own fix,
   * which is a claim about a person being somewhere, and only a verified
   * citizen may make it. The server checks that too.
   */
  function findMe(mode: "center" | "here") {
    setLocating(mode);
    setGpsError(null);

    // Not awaited before the request: Safari shows no prompt if anything is
    // awaited between the tap and the call, so `requestPosition` asks first
    // and this handles the answer.
    void requestPosition().then((result) => {
      setLocating(null);

      if (!result.ok) {
        setGpsError(locationCopy(result.problem satisfies LocationProblem));
        return;
      }

      if (mode === "center") {
        onCenter(result.position);
        return;
      }

      // Same rule as the button: refuse only what is known to be outside.
      if (municipalityAt(result.position, boundaries).state === "outside") {
        setGpsError(t("outsideProvince"));
        return;
      }
      onConfirm(result.position, "gps");
    });
  }

  return (
    <>
      {/* A zero-sized box on the map's exact centre, so the shadow marks the
          coordinate and the pin can lift off it while the map moves — which is
          what makes it read as hovering over a point rather than being painted
          onto the tiles. */}
      <div
        className={cn(
          "pointer-events-none absolute left-1/2 z-30 size-0",
          !showCrosshair && "hidden",
        )}
        style={{ top: `${CROSSHAIR_FRACTION * 100}%` }}
        aria-hidden
      >
        <span
          className={cn(
            "-translate-x-1/2 -translate-y-1/2 absolute top-0 left-0 block h-2 w-5 rounded-[50%] bg-foreground/35 blur-[2px] transition-all duration-200",
            moving && "h-1.5 w-7 bg-foreground/20",
            !aimingWithCrosshair && "opacity-0",
          )}
        />
        <span
          className={cn(
            "-translate-x-1/2 absolute bottom-0 left-0 block transition-all duration-200 ease-out",
            moving && "-translate-y-3",
            !aimingWithCrosshair && "scale-90 opacity-30",
          )}
        >
          <DraftPin purpose={purpose} />
        </span>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-30 p-3 md:pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {/* Kept short on purpose: everything below the crosshair is map the
            person cannot see, and the shaded street is drawn there. */}
        <div className="mx-auto flex max-h-[42dvh] max-w-md flex-col gap-2.5 overflow-y-auto rounded-3xl border bg-background/97 p-3 shadow-2xl backdrop-blur-sm md:max-h-[65dvh] md:gap-3.5 md:p-4">
          {/* Two words, one row, both full-height: the choice between a point
              and a stretch is the first thing to make and the easiest to
              change, so it sits above everything and never moves. */}
          {purpose === "traffic" && (
            <fieldset
              className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1"
              aria-label={trafficCopy("shapeLabel")}
            >
              {(["street", "point"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={shape === option}
                  onClick={() => onShapeChange(option)}
                  className={cn(
                    "flex min-h-10 items-center justify-center gap-2 rounded-lg font-medium text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    shape === option
                      ? "bg-background shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {option === "point" ? (
                    <MapPin className="size-4" aria-hidden />
                  ) : (
                    <Route className="size-4" aria-hidden />
                  )}
                  {trafficCopy(
                    option === "point" ? "shapePoint" : "shapeStreet",
                  )}
                </button>
              ))}
            </fieldset>
          )}

          <div>
            <p className="font-medium text-[15px] leading-snug">
              {/* The street's own name when OSM has one — the clearest
                  confirmation there is that the map understood which road is
                  meant, far clearer than any coordinate. Much of this province
                  is mapped without names, so a found-but-unnamed road still has
                  to say it was found; the shading on the map is the rest of
                  the answer. */}
              {!markingStreet
                ? t("pickPoint")
                : street
                  ? (street.name ?? trafficCopy("streetUnnamed"))
                  : !streetsTappable
                    ? trafficCopy("streetZoomHint")
                    : trafficCopy(
                        // A finger drags the map under a pin; a pointer clicks
                        // the road itself. Naming the wrong gesture is worse
                        // than naming none.
                        showCrosshair ? "streetHint" : "streetHintDesktop",
                      )}
            </p>
            <p className="mt-0.5 truncate text-muted-foreground text-xs">
              {markingStreet && street ? (
                trafficCopy("streetLength", { meters: street.lengthMeters })
              ) : (
                <>
                  {municipality ? `${municipality.name} · ` : ""}
                  <span className="font-mono">
                    {aim.lat.toFixed(5)}, {aim.lng.toFixed(5)}
                  </span>
                </>
              )}
            </p>
          </div>

          {/* The hint says "get closer"; this is how. Pinching to the right
              zoom is the slow part on a phone, and pressing the same button a
              route would offer gets there in one gesture. */}
          {markingStreet && !streetsTappable && !street && (
            <Button
              type="button"
              variant="secondary"
              className="min-h-11"
              onClick={() => onCenter({ lng: aim.lng, lat: aim.lat })}
            >
              <ZoomIn className="size-4" aria-hidden />
              {trafficCopy("zoomIn")}
            </Button>
          )}

          {markingStreet && street && streetsTappable && (
            <fieldset className="flex items-center gap-2">
              <legend className="sr-only">{trafficCopy("extent")}</legend>
              <span
                className="shrink-0 text-muted-foreground text-xs"
                aria-hidden
              >
                {trafficCopy("extentShort")}
              </span>
              <div className="flex flex-1 gap-1.5">
                {STREET_EXTENTS.map((value) => (
                  <Button
                    key={value}
                    variant={extentMeters === value ? "secondary" : "outline"}
                    aria-pressed={extentMeters === value}
                    className="h-10 flex-1 px-2 text-sm"
                    onClick={() => onExtentChange(value)}
                  >
                    {trafficCopy("extentMeters", { count: value })}
                  </Button>
                ))}
              </div>
            </fieldset>
          )}
          {markingStreet &&
            anchor &&
            (streetQuery.data?.candidates.length ?? 0) > 1 && (
              <details>
                <summary className="cursor-pointer py-2 text-sm font-medium">
                  {trafficCopy("chooseNearby")}
                </summary>
                <div className="flex max-h-36 flex-col gap-1 overflow-y-auto">
                  {streetQuery.data?.candidates.map((candidate) => (
                    <Button
                      key={candidate.id}
                      className="h-auto min-h-11 justify-between gap-3 text-left whitespace-normal"
                      variant={
                        candidate.id === street?.roadId ? "secondary" : "ghost"
                      }
                      aria-pressed={candidate.id === street?.roadId}
                      onClick={() =>
                        onAnchorChange({ ...anchor, roadId: candidate.id })
                      }
                    >
                      <span>
                        {candidate.name ?? trafficCopy("streetUnnamed")}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {trafficCopy("awayMeters", {
                          count: candidate.distanceMeters,
                        })}
                      </span>
                    </Button>
                  ))}
                </div>
              </details>
            )}
          {awaitingStreetClick && (
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() => onAnchorChange({ lng: aim.lng, lat: aim.lat })}
            >
              {trafficCopy("chooseAtCenter")}
            </Button>
          )}
          {markingStreet && streetsTappable && streetQuery.isError && (
            <div role="alert" className="space-y-2 text-sm">
              <p>{trafficCopy("streetLookupFailed")}</p>
              <Button
                variant="outline"
                onClick={() => void streetQuery.refetch()}
              >
                {trafficCopy("retryStreet")}
              </Button>
            </div>
          )}
          {(noStreet || roadsUnavailable) && (
            <p
              role="status"
              className="flex items-start gap-2 rounded-xl bg-amber-500/10 px-3 py-2.5 text-[13px] text-amber-700 leading-snug dark:text-amber-400"
            >
              <TriangleAlert className="mt-px size-4 shrink-0" aria-hidden />
              {trafficCopy(
                roadsUnavailable ? "streetsUnavailable" : "noStreetHere",
              )}
            </p>
          )}

          {outside && (
            <p
              role="status"
              className="flex items-start gap-2 rounded-xl bg-amber-500/10 px-3 py-2.5 text-[13px] text-amber-700 leading-snug dark:text-amber-400"
            >
              <TriangleAlert className="mt-px size-4 shrink-0" aria-hidden />
              {t("outsideProvince")}
            </p>
          )}

          {gpsError && (
            <p
              role="alert"
              className="rounded-xl bg-destructive/10 px-3 py-2.5 text-[13px] text-destructive leading-snug"
            >
              {gpsError}
            </p>
          )}

          {/* Both targets are full-height and side by side rather than a small
              ghost button in a corner: this bar is used one-handed, at arm's
              length, often outdoors. */}
          <div className="flex gap-2">
            {/* Open to everyone: getting the crosshair onto where you are
                standing is the fastest path to an accurate point, and moving a
                map is not a claim about anything. */}
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-12 shrink-0 md:size-13"
              aria-label={t("centerOnMe")}
              title={t("centerOnMe")}
              disabled={locating !== null}
              onClick={() => findMe("center")}
            >
              {locating === "center" ? (
                <Spinner className="size-5" />
              ) : (
                <Crosshair className="size-5" aria-hidden />
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              className="h-12 flex-1 text-base md:h-13"
              onClick={onCancel}
            >
              {t("cancel")}
            </Button>
            <Button
              type="button"
              className="h-12 flex-[2] text-base md:h-13"
              disabled={
                outside ||
                moving ||
                (markingStreet &&
                  (!street ||
                    // Only while the lookup is the thing being waited on:
                    // zoomed out it is disabled, and a road chosen before the
                    // zoom is a decision, not a pending question.
                    (streetsTappable &&
                      (streetQuery.isFetching || streetQuery.isError))))
              }
              onClick={() =>
                onConfirm(
                  {
                    ...(anchor ?? aim),
                    roadId: markingStreet ? street?.roadId : undefined,
                  },
                  "map",
                  markingStreet && street ? street : undefined,
                )
              }
            >
              {markingStreet ? trafficCopy("confirmStreet") : t("confirmPoint")}
            </Button>
          </div>

          {canUseGps ? (
            <Button
              type="button"
              variant="ghost"
              className="h-10 w-full text-[15px] md:h-11"
              disabled={locating !== null}
              onClick={() => findMe("here")}
            >
              {locating === "here" ? (
                <Spinner className="size-4" />
              ) : (
                <LocateFixed className="size-4" aria-hidden />
              )}
              {locating === "here"
                ? locationCopy("locating")
                : locationCopy("use")}
            </Button>
          ) : showVerifyHint ? (
            // Not a locked button with a padlock: a sentence that says what
            // verification is *for*. This is the clearest place in the whole
            // app to explain why a cédula is worth the trouble.
            <p className="text-balance text-center text-muted-foreground text-xs leading-relaxed">
              {t("gpsOnlyForCitizens")}{" "}
              <Link
                href="/verificar"
                className="font-medium text-foreground underline underline-offset-4"
              >
                {t("verifyNow")}
              </Link>
            </p>
          ) : null}
        </div>
      </div>
    </>
  );
}
