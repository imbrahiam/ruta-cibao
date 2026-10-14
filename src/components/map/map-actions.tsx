"use client";

import {
  Download,
  LocateFixed,
  MapPinPlus,
  Minus,
  Plus,
  Share2,
  Stamp,
  TrafficCone,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useInstall } from "@/components/offline/install-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Link } from "@/i18n/navigation";
import { type LocationProblem, requestPosition } from "@/lib/geolocation";
import { shareUrl } from "@/lib/share";
import { cn } from "@/lib/utils";

/**
 * What the map lets you do without leaving it.
 *
 * Two circles in the bottom-right corner, where a hand already is on a phone
 * and where every map application puts them: "where am I", always visible,
 * and one "+" that fans out the things people reach for far less often —
 * adding a place, reporting the road, and sharing the current view. Three
 * permanent targets used to compete with the zoom controls in the same corner;
 * the menu keeps the corner to a locate button plus one overflow, with the zoom
 * below it.
 *
 * Reporting traffic sits in the menu rather than getting its own circle, even
 * though it is the most urgent thing here. A permanent button for it would be a
 * permanent invitation to report, and a map with a cone on every corner is a
 * map nobody believes.
 */
/**
 * The floating controls, as one instrument.
 *
 * Every control over the map shares a surface: white, a 16px radius, a
 * hairline and the same soft shadow — the login screen's tile and input
 * language brought onto the map. "Where am I" and zoom are cells of a single
 * stack divided by hairlines, the way Apple and Google group them, rather
 * than three separately drawn objects; "Aportar" sits above it in the brand
 * green, same height, same radius, same shadow.
 */
const SURFACE =
  "border border-black/[0.07] bg-card shadow-[0_1px_2px_rgb(0_0_0/0.06),0_6px_16px_-6px_rgb(0_0_0/0.18)]";

const CELL =
  "flex size-12 items-center justify-center text-foreground transition-colors hover:bg-secondary focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset active:bg-secondary";

/**
 * The way in to contributing: a labelled green button, not a bare "+". A "+"
 * alone asks the reader to guess between zoom, add and more; the word answers.
 */
const PRIMARY =
  "flex h-12 items-center gap-2 rounded-[16px] border border-transparent bg-primary pr-4 pl-3.5 font-semibold text-[15px] text-primary-foreground shadow-[0_1px_2px_rgb(0_0_0/0.06),0_6px_16px_-6px_rgb(0_0_0/0.18)] transition-[background-color,transform] hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.98] data-popup-open:bg-foreground";

export function MapActions({
  onLocate,
  onAddPlace,
  onReportTraffic,
  concealed = false,
  onZoom,
}: {
  onLocate: (
    position: { lng: number; lat: number },
    accuracyMeters: number,
  ) => void;
  onAddPlace: () => void;
  onReportTraffic: () => void;
  /**
   * A sheet is open over the map. On a phone the column then fades out: the
   * sheet's peek height varies with the screen, and on a 360 px Android the
   * "+" ended up half under it — a control that looks broken. The sheet has
   * its own actions; the column returns when it closes.
   */
  concealed?: boolean;
  /** Zoom in or out; the buttons show only where there is a mouse. */
  onZoom?: (delta: 1 | -1) => void;
}) {
  const t = useTranslations("map.actions");
  const a11y = useTranslations("map.accessibility");
  const installT = useTranslations("install");
  const passportT = useTranslations("passport");
  const { installed } = useInstall();
  const locationCopy = useTranslations("location");
  const moreT = useTranslations("map.place");
  const [locating, setLocating] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  function locate() {
    setLocating(true);

    // Called with nothing awaited in front of it: Safari drops the permission
    // prompt when the gesture is a tick old.
    void requestPosition().then((result) => {
      setLocating(false);

      if (result.ok) {
        onLocate(result.position, result.accuracyMeters);
        return;
      }

      // It used to fail in silence, on the grounds that declining is
      // ordinary. So is tapping a button and having nothing at all happen,
      // which is what somebody on plain http got — no prompt, no map move, no
      // reason. The toast says which of the five it was.
      toast.error(locationCopy(result.problem satisfies LocationProblem));
    });
  }

  async function share() {
    // The whole view is in the address bar, so sharing is sharing the URL.
    const outcome = await shareUrl({ url: window.location.href });
    if (outcome === "copied") toast.success(moreT("copied"));
    // No clipboard of any kind here — over plain HTTP there is none. The
    // address bar is still a link, and saying so beats a tick that copied
    // nothing.
    if (outcome === "failed") toast.error(moreT("copyFailed"));
  }

  return (
    // `right` respects the swipe-bar edge on notched phones; `bottom-14`
    // clears the attribution (i) below the stack.
    <div
      className={cn(
        "absolute right-[max(0.75rem,env(safe-area-inset-right))] bottom-14 z-20 flex flex-col items-end gap-2.5 transition-opacity duration-200",
        // On a phone the sheet covers the corner, so the column steps out;
        // on a desktop it steps left of the 26rem panel and stays usable.
        concealed &&
          "max-md:pointer-events-none max-md:opacity-0 md:right-[27.5rem]",
      )}
      inert={concealed && !isDesktop}
    >
      {/* The shared menu component rather than a hand-built one: focus moves
          in on open, arrow keys and typeahead walk it, Escape and an outside
          tap close it and hand focus back — the same behaviour as the place
          sheet's "…" menu, and one menu style across the app. */}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<button type="button" className={PRIMARY} />}
        >
          <Plus className="size-5" strokeWidth={2.5} aria-hidden />
          {t("contribute")}
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="left"
          align="end"
          sideOffset={10}
          className="w-60 rounded-2xl p-1.5 shadow-xl"
        >
          <DropdownMenuItem
            onClick={onAddPlace}
            className="min-h-12 gap-3 rounded-xl px-2.5 py-2 text-[15px]"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
              <MapPinPlus className="size-4" aria-hidden />
            </span>
            {t("addPlace")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={onReportTraffic}
            className="min-h-12 gap-3 rounded-xl px-2.5 py-2 text-[15px]"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800">
              <TrafficCone className="size-4" aria-hidden />
            </span>
            {t("reportTraffic")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => void share()}
            className="min-h-12 gap-3 rounded-xl px-2.5 py-2 text-[15px]"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
              <Share2 className="size-4" aria-hidden />
            </span>
            {t("share")}
          </DropdownMenuItem>
          <DropdownMenuItem
            nativeButton={false}
            render={<Link href="/pasaporte" />}
            className="min-h-12 gap-3 rounded-xl px-2.5 py-2 text-[15px]"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
              <Stamp className="size-4" aria-hidden />
            </span>
            {passportT("open")}
          </DropdownMenuItem>
          {!installed && (
            <DropdownMenuItem
              nativeButton={false}
              render={<Link href="/instalar" />}
              className="min-h-12 gap-3 rounded-xl px-2.5 py-2 text-[15px]"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
                <Download className="size-4" aria-hidden />
              </span>
              {installT("action")}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <div
        className={cn(
          "flex flex-col divide-y divide-black/[0.07] overflow-hidden rounded-[16px]",
          SURFACE,
        )}
      >
        <button
          type="button"
          onClick={locate}
          aria-label={t("locate")}
          title={t("locate")}
          aria-busy={locating}
          className={CELL}
        >
          {locating ? (
            <Spinner className="size-5" />
          ) : (
            <LocateFixed className="size-5 text-primary" aria-hidden />
          )}
        </button>
        {/* With a mouse only: on a touchscreen the pinch is the zoom, and
            two more buttons would be clutter in the thumb's corner. */}
        {onZoom && (
          <>
            <button
              type="button"
              onClick={() => onZoom(1)}
              aria-label={a11y("zoomIn")}
              title={a11y("zoomIn")}
              className={cn(CELL, "hidden pointer-fine:flex")}
            >
              <Plus className="size-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => onZoom(-1)}
              aria-label={a11y("zoomOut")}
              title={a11y("zoomOut")}
              className={cn(CELL, "hidden pointer-fine:flex")}
            >
              <Minus className="size-5" aria-hidden />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
