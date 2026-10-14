"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A row of place cards you swipe on a phone and step through on a desktop.
 *
 * It never moves on its own. The buttons scroll by one viewport of cards and
 * disable themselves at either end, so a mouse user is never left pressing an
 * arrow that does nothing.
 */
export function PlacesScroller({
  heading,
  children,
}: {
  heading: React.ReactNode;
  children: React.ReactNode;
}) {
  const t = useTranslations("landing.places");
  const track = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const measure = useCallback(() => {
    const element = track.current;
    if (!element) return;
    setEdges({
      start: element.scrollLeft <= 4,
      end: element.scrollLeft + element.clientWidth >= element.scrollWidth - 4,
    });
  }, []);

  useEffect(() => {
    measure();
    const element = track.current;
    element?.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      element?.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  const step = (direction: 1 | -1) => {
    const element = track.current;
    if (!element) return;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    element.scrollBy({
      left: direction * element.clientWidth * 0.85,
      behavior: reduce ? "auto" : "smooth",
    });
  };

  const buttonClass =
    "flex size-12 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-35 disabled:hover:bg-card";

  return (
    <div>
      <div className="mb-5 flex items-end justify-between gap-4 px-6 md:mb-7 md:px-0">
        {heading}
        <div className="hidden shrink-0 gap-2 md:flex">
          <button
            type="button"
            className={buttonClass}
            onClick={() => step(-1)}
            disabled={edges.start}
            aria-label={t("previous")}
            title={t("previous")}
          >
            <ArrowLeft className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            className={buttonClass}
            onClick={() => step(1)}
            disabled={edges.end}
            aria-label={t("next")}
            title={t("next")}
          >
            <ArrowRight className="size-5" aria-hidden />
          </button>
        </div>
      </div>
      <ul
        ref={track}
        className="landing-track flex snap-x snap-mandatory scroll-px-6 gap-4 overflow-x-auto px-6 pb-2 md:scroll-px-0 md:gap-5 md:px-0"
      >
        {children}
      </ul>
    </div>
  );
}
