"use client";

import {
  Download,
  LocateFixed,
  MapPinPlus,
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
 * The shared look of the floating circles: the same white disc, hairline and
 * soft shadow as the search pill above, so the controls over the map read as
 * one family rather than three components that happen to share a screen.
 */
const FLOATING =
  "flex size-12 items-center justify-center rounded-full border border-black/5 bg-background text-foreground shadow-[0_2px_10px_-2px_rgb(0_0_0/0.22)] transition-[background-color,box-shadow,transform] hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95 data-popup-open:bg-foreground data-popup-open:text-background";

/**
 * The "+" is filled in the primary colour. White, it was the twin of the zoom
 * control's "+" a few pixels below it, and people pressing it to zoom in got a
 * menu instead.
 */
const FLOATING_PRIMARY = cn(
  FLOATING,
  "border-transparent bg-primary text-primary-foreground hover:bg-primary/90",
);

export function MapActions({
  onLocate,
  onAddPlace,
  onReportTraffic,
}: {
  onLocate: (
    position: { lng: number; lat: number },
    accuracyMeters: number,
  ) => void;
  onAddPlace: () => void;
  onReportTraffic: () => void;
}) {
  const t = useTranslations("map.actions");
  const installT = useTranslations("install");
  const passportT = useTranslations("passport");
  const { installed } = useInstall();
  const locationCopy = useTranslations("location");
  const moreT = useTranslations("map.place");
  const [locating, setLocating] = useState(false);

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
    // `right` respects the swipe-bar edge on notched phones. `bottom-28`
    // clears the attribution; with a mouse the renderer adds zoom buttons in
    // the same corner, so the column sits higher to stay clear of them.
    <div className="absolute right-[max(0.75rem,env(safe-area-inset-right))] bottom-28 z-20 flex flex-col items-end gap-2.5 pointer-fine:bottom-40">
      {/* The shared menu component rather than a hand-built one: focus moves
          in on open, arrow keys and typeahead walk it, Escape and an outside
          tap close it and hand focus back — the same behaviour as the place
          sheet's "…" menu, and one menu style across the app. */}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label={moreT("more")}
              title={moreT("more")}
              className={FLOATING_PRIMARY}
            />
          }
        >
          <Plus className="size-5" aria-hidden />
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

      <button
        type="button"
        onClick={locate}
        aria-label={t("locate")}
        title={t("locate")}
        aria-busy={locating}
        className={FLOATING}
      >
        {locating ? (
          <Spinner className="size-5" />
        ) : (
          <LocateFixed className="size-5 text-primary" aria-hidden />
        )}
      </button>
    </div>
  );
}
