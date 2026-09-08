"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ViewerPhoto = { src: string; alt: string };

/**
 * A minimal photo viewer, fullscreen on every screen.
 *
 * One component for the place drawer and the chat: swipe sideways on a phone
 * (the track follows the finger and snaps), buttons and arrow keys where
 * there is a keyboard. Escape, focus trap and scroll lock come from the
 * dialog underneath. Nothing else — no zoom, no share, no metadata.
 */
export function ImageViewer({
  photos,
  index,
  onIndexChange,
  open,
  onOpenChange,
  title,
  counter,
  labels,
}: {
  photos: ViewerPhoto[];
  index: number;
  onIndexChange: (index: number) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Announced as the dialog name, e.g. the place name. */
  title: string;
  /** Preformatted "3 de 8" for the current index. */
  counter: string;
  labels: { close: string; previous: string; next: string };
}) {
  const track = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ startX: number; dx: number } | null>(null);
  const current = Math.min(Math.max(index, 0), Math.max(photos.length - 1, 0));
  const swipeable = photos.length > 1;

  function go(next: number) {
    onIndexChange(Math.min(Math.max(next, 0), photos.length - 1));
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          data-slot="image-viewer-overlay"
          className="fixed inset-0 z-50 bg-black/90 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
        />
        <DialogPrimitive.Popup
          data-slot="image-viewer"
          aria-label={title}
          className="fixed inset-0 z-50 flex flex-col text-white outline-none"
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") go(current - 1);
            if (event.key === "ArrowRight") go(current + 1);
          }}
        >
          <DialogPrimitive.Title className="sr-only">
            {title}
          </DialogPrimitive.Title>

          <div className="flex shrink-0 items-center justify-between p-3">
            <p
              className="text-sm tabular-nums text-white/70"
              aria-live="polite"
            >
              {counter}
            </p>
            <DialogPrimitive.Close
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full text-white hover:bg-white/10 hover:text-white"
                  aria-label={labels.close}
                />
              }
            >
              <X className="size-5" aria-hidden />
            </DialogPrimitive.Close>
          </div>

          <div
            ref={track}
            className="relative min-h-0 flex-1 overflow-hidden"
            onTouchStart={(event) => {
              if (!swipeable) return;
              setDrag({ startX: event.touches[0]?.clientX ?? 0, dx: 0 });
            }}
            onTouchMove={(event) => {
              setDrag((active) => {
                if (!active) return active;
                const width = track.current?.clientWidth ?? 1;
                let dx =
                  (event.touches[0]?.clientX ?? active.startX) - active.startX;
                // Rubber-band at the ends rather than a dead stop.
                if (
                  (current === 0 && dx > 0) ||
                  (current === photos.length - 1 && dx < 0)
                ) {
                  dx /= 3;
                }
                return { ...active, dx: Math.max(-width, Math.min(width, dx)) };
              });
            }}
            onTouchEnd={() => {
              setDrag((active) => {
                if (!active) return active;
                const width = track.current?.clientWidth ?? 1;
                if (active.dx <= -width * 0.22) go(current + 1);
                else if (active.dx >= width * 0.22) go(current - 1);
                return null;
              });
            }}
          >
            <div
              className={cn(
                "flex h-full",
                // The snap animates; following the finger does not.
                drag === null &&
                  "motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out",
              )}
              style={{
                transform: `translateX(calc(${-current * 100}% + ${drag?.dx ?? 0}px))`,
              }}
            >
              {photos.map((photo) => (
                <div
                  key={photo.src}
                  className="relative h-full w-full shrink-0"
                >
                  <Image
                    src={photo.src}
                    alt={photo.alt}
                    fill
                    sizes="100vw"
                    className="object-contain"
                    unoptimized
                  />
                </div>
              ))}
            </div>
          </div>

          {swipeable && (
            <div className="flex shrink-0 items-center justify-between p-3">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full text-white hover:bg-white/10 hover:text-white disabled:opacity-30"
                aria-label={labels.previous}
                disabled={current === 0}
                onClick={() => go(current - 1)}
              >
                <ChevronLeft className="size-5" aria-hidden />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full text-white hover:bg-white/10 hover:text-white disabled:opacity-30"
                aria-label={labels.next}
                disabled={current === photos.length - 1}
                onClick={() => go(current + 1)}
              >
                <ChevronRight className="size-5" aria-hidden />
              </Button>
            </div>
          )}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
