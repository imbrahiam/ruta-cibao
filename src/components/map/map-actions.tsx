"use client";

import {
  Check,
  Crosshair,
  MapPinPlus,
  Plus,
  Share2,
  TrafficCone,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { type LocationProblem, requestPosition } from "@/lib/geolocation";
import { shareUrl } from "@/lib/share";

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
function ActionButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex size-11 items-center justify-center rounded-full border bg-background text-foreground shadow-md transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
    </button>
  );
}

function MenuRow({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
        {children}
      </span>
      {label}
    </button>
  );
}

export function MapActions({
  onLocate,
  onAddPlace,
  onReportTraffic,
}: {
  onLocate: (position: { lng: number; lat: number }) => void;
  onAddPlace: () => void;
  onReportTraffic: () => void;
}) {
  const t = useTranslations("map.actions");
  const locationCopy = useTranslations("location");
  const moreT = useTranslations("map.place");
  const closeT = useTranslations("shell");
  const [locating, setLocating] = useState(false);
  const [shared, setShared] = useState(false);
  const [open, setOpen] = useState(false);

  // The menu is a small modal over the map: Escape folds it back to the "+".
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function locate() {
    setLocating(true);

    // Called with nothing awaited in front of it: Safari drops the permission
    // prompt when the gesture is a tick old.
    void requestPosition().then((result) => {
      setLocating(false);

      if (result.ok) {
        onLocate(result.position);
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

    if (outcome === "shared") {
      setOpen(false);
      return;
    }

    if (outcome === "failed") {
      // No clipboard of any kind here — over plain HTTP there is none. The
      // address bar is still a link, and saying so beats a check mark that
      // copied nothing.
      toast.error(moreT("copyFailed"));
      setOpen(false);
      return;
    }

    setShared(true);
    setTimeout(() => {
      setShared(false);
      setOpen(false);
    }, 1500);
  }

  return (
    <>
      {/* Catches taps outside the open menu so it folds back away. */}
      {open && (
        <div
          aria-hidden
          className="fixed inset-0 z-10"
          onClick={() => setOpen(false)}
        />
      )}
      {/* `right` respects the swipe-bar edge on notched phones; `bottom-28`
          matches the 10px inset the renderers give their own zoom controls, so
          these line up above them instead of sitting a few pixels inside. */}
      <div className="absolute right-[max(0.625rem,env(safe-area-inset-right))] bottom-28 z-20 flex flex-col items-end gap-2">
        {open && (
          <div
            role="menu"
            aria-label={moreT("more")}
            className="w-56 rounded-2xl border bg-background p-1.5 shadow-lg"
          >
            <MenuRow
              label={t("addPlace")}
              onClick={() => {
                setOpen(false);
                onAddPlace();
              }}
            >
              <MapPinPlus className="size-4" aria-hidden />
            </MenuRow>
            <MenuRow
              label={t("reportTraffic")}
              onClick={() => {
                setOpen(false);
                onReportTraffic();
              }}
            >
              <TrafficCone className="size-4" aria-hidden />
            </MenuRow>
            <MenuRow label={t("share")} onClick={() => void share()}>
              {shared ? (
                <Check className="size-4" aria-hidden />
              ) : (
                <Share2 className="size-4" aria-hidden />
              )}
            </MenuRow>
          </div>
        )}

        <ActionButton
          label={open ? closeT("close") : moreT("more")}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? (
            <X className="size-5" aria-hidden />
          ) : (
            <Plus className="size-5" aria-hidden />
          )}
        </ActionButton>

        <ActionButton label={t("locate")} onClick={locate}>
          {locating ? (
            <Spinner className="size-5" />
          ) : (
            <Crosshair className="size-5" aria-hidden />
          )}
        </ActionButton>
      </div>
    </>
  );
}
