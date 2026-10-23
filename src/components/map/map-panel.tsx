"use client";

import { Drawer } from "@base-ui/react/drawer";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useEffect, useState } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cx } from "@/lib/cx";

/** Peek, half, almost full: the three heights a phone map sheet settles at. */
const SNAP_POINTS = ["320px", 0.62, 0.94];

/**
 * Where the map shows what was tapped.
 *
 * On a phone, a bottom sheet that never covers the whole map: it opens at a
 * peek that holds the name and the main action, drags up for the rest, and
 * leaves the map pannable behind it. From 810px up the same content sits in a
 * floating panel on the left, the way desktop map apps put a place beside the
 * map rather than over it.
 *
 * `contentKey` changes when the subject changes (another place, a report);
 * the sheet stays mounted and only the content cross-fades, so tapping from
 * pin to pin does not make the panel slide out and back in.
 */
export function MapPanel({
  open,
  onClose,
  title,
  contentKey,
  children,
  header,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  contentKey: string;
  children: ReactNode;
  header?: ReactNode;
}) {
  const desktop = useMediaQuery("(min-width: 50.625rem)");
  const t = useTranslations("common");
  const [snap, setSnap] = useState<Drawer.Root.SnapPoint | null>(
    SNAP_POINTS[0] ?? null,
  );

  // A new subject opens at the peek again, whatever height the last one had.
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the subject
  useEffect(() => {
    setSnap(SNAP_POINTS[0] ?? null);
  }, [contentKey]);

  if (desktop) {
    if (!open) return null;
    return (
      <aside
        aria-label={title}
        className="pointer-events-auto absolute top-[132px] bottom-4 left-4 z-20 flex w-[400px] flex-col overflow-hidden rounded-panel bg-card shadow-lg animate-panel"
      >
        <div className="absolute top-3 right-3 z-10">
          <button
            type="button"
            aria-label={t("close")}
            onClick={onClose}
            className="press glass flex size-9 items-center justify-center rounded-full text-ink-2 hover:text-ink"
          >
            <X strokeWidth={1.5} className="size-[18px]" />
          </button>
        </div>
        {header}
        <div
          key={contentKey}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain animate-panel"
        >
          {children}
        </div>
      </aside>
    );
  }

  return (
    <Drawer.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      modal={false}
      disablePointerDismissal
      swipeDirection="down"
      snapPoints={SNAP_POINTS}
      snapPoint={snap}
      onSnapPointChange={setSnap}
    >
      <Drawer.Portal>
        <Drawer.Viewport className="pointer-events-none fixed inset-0 z-30 flex items-end">
          <Drawer.Popup
            aria-label={title}
            className={cx(
              "pointer-events-auto relative flex w-full flex-col rounded-t-panel bg-card text-ink shadow-lg outline-none",
              "max-h-[calc(100dvh-12px)] [transform:translateY(calc(var(--drawer-snap-point-offset,0px)+var(--drawer-swipe-movement-y,0px)))] [padding-bottom:max(0px,calc(var(--drawer-snap-point-offset,0px)+var(--drawer-swipe-movement-y,0px)))]",
              "transition-[transform] duration-[420ms] ease-soft data-[swiping]:duration-0",
              "data-[starting-style]:[transform:translateY(100%)] data-[ending-style]:[transform:translateY(100%)] data-[ending-style]:duration-300 data-[ending-style]:ease-in",
              "after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-12 after:bg-card",
            )}
          >
            <div className="flex shrink-0 cursor-grab justify-center pt-2.5 pb-1 active:cursor-grabbing">
              <span aria-hidden className="h-1 w-9 rounded-full bg-paper-3" />
            </div>
            <Drawer.Title className="sr-only">{title}</Drawer.Title>
            <div className="absolute top-2.5 right-3 z-10">
              <Drawer.Close
                aria-label={t("close")}
                className="press flex size-11 items-center justify-center rounded-full text-ink-3 hover:bg-paper-3 hover:text-ink"
              >
                <X strokeWidth={1.5} className="size-[18px]" />
              </Drawer.Close>
            </div>
            {header}
            <Drawer.Content
              key={contentKey}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom,0px)] animate-panel"
            >
              {children}
            </Drawer.Content>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
