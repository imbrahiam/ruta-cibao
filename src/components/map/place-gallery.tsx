"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ImageViewer } from "@/components/ui/image-viewer";
import { cn } from "@/lib/utils";

/**
 * Every picture of a place, across the top of the drawer.
 *
 * One image used to sit here and the contributed ones lived in a strip further
 * down, which showed the same photograph twice and put the newest one where
 * nobody scrolled. There is one gallery now, and it is the first thing on the
 * sheet: swipe it sideways, tap to open it full screen.
 *
 * Native scroll snapping rather than a transform track. The finger keeps the
 * momentum the OS gives it, a trackpad and a scrollbar work without extra
 * code, and no state has to be right for the picture to move — the index is
 * read back off the scroll position, and only the dots depend on it.
 */
export function PlaceGallery({
  name,
  imageUrl,
  photos,
}: {
  name: string;
  /** The seeded, illustrative picture, if this place has one. */
  imageUrl: string | null;
  /** Published contributions, oldest first. */
  photos: string[];
}) {
  const t = useTranslations("map.place");
  const tp = useTranslations("map.photos");
  const tv = useTranslations("viewer");
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [viewIndex, setViewIndex] = useState<number | null>(null);

  // The illustrative picture leads, and appears once: the seed points it and a
  // photo row at the same file, and a carousel that opens on the same image
  // twice reads as a bug.
  const slides = [...new Set([...(imageUrl ? [imageUrl] : []), ...photos])];

  if (slides.length === 0) return null;

  const label = (index: number) => tp("alt", { name, number: index + 1 });

  return (
    <div className="relative aspect-[16/8] w-full bg-muted">
      <div
        ref={track}
        // The scrollbar would sit on top of the photograph; the dots say what
        // it would have said.
        className="no-scrollbar flex h-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
        onScroll={(event) => {
          const el = event.currentTarget;
          setActive(Math.round(el.scrollLeft / Math.max(el.clientWidth, 1)));
        }}
      >
        {slides.map((src, index) => (
          <button
            key={src}
            type="button"
            onClick={() => setViewIndex(index)}
            aria-label={label(index)}
            className="relative h-full w-full shrink-0 snap-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          >
            <Image
              src={src}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, 26rem"
              className="object-cover"
              // The first one is what the drawer opens on, so it is not lazy;
              // a contributed photo is a signed URL the optimiser cannot take.
              priority={index === 0}
              unoptimized
            />
          </button>
        ))}
      </div>

      {imageUrl && slides[active] === imageUrl && (
        <Badge className="pointer-events-none absolute bottom-2 left-2 bg-background/90 text-muted-foreground shadow-sm backdrop-blur-sm">
          {t("illustrativeImage")}
        </Badge>
      )}

      {slides.length > 1 && (
        // Position, not navigation: the dots are too small to be a tap target
        // and the photographs themselves are the control.
        <div
          aria-hidden
          className="-translate-x-1/2 pointer-events-none absolute bottom-3 left-1/2 flex gap-1.5 rounded-full bg-black/35 px-2 py-1.5 backdrop-blur-sm"
        >
          {slides.map((src, index) => (
            <span
              key={src}
              className={cn(
                // The pill is what makes them legible: white dots alone
                // disappear into a bright sky, and a photograph of one is
                // exactly what somebody will upload.
                "size-1.5 rounded-full bg-white/45 motion-safe:transition-colors",
                index === active && "bg-white",
              )}
            />
          ))}
        </div>
      )}

      <ImageViewer
        photos={slides.map((src, index) => ({ src, alt: label(index) }))}
        index={viewIndex ?? 0}
        onIndexChange={setViewIndex}
        open={viewIndex !== null}
        onOpenChange={(open) => {
          if (open) return;
          // Leave the strip on whatever the viewer was last showing, so
          // closing it does not throw away the swiping done inside.
          const index = viewIndex ?? 0;
          setViewIndex(null);
          const el = track.current;
          el?.scrollTo({ left: index * el.clientWidth });
        }}
        title={name}
        counter={
          viewIndex !== null
            ? tv("counter", { current: viewIndex + 1, total: slides.length })
            : ""
        }
        labels={{
          close: tv("close"),
          previous: tv("previous"),
          next: tv("next"),
        }}
      />
    </div>
  );
}
