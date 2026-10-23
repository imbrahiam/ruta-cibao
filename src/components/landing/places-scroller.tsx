"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

/** A swipeable row that only moves when the visitor asks it to. */
export function PlacesScroller({
  heading,
  children,
}: {
  heading: ReactNode;
  children: ReactNode;
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
    const element = track.current;
    measure();
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
    element.scrollBy({
      left: direction * element.clientWidth * 0.82,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  };

  const buttonClass =
    "press flex size-11 items-center justify-center rounded-full bg-card text-ink shadow-ring hover:bg-paper-2 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-default disabled:opacity-35";

  return (
    <div>
      <div className="mb-7 flex items-end justify-between gap-4 px-4 sm:px-6 lg:px-0">
        {heading}
        <div className="hidden shrink-0 gap-2 md:flex">
          <button
            type="button"
            className={buttonClass}
            onClick={() => step(-1)}
            disabled={edges.start}
            aria-label={t("previous")}
          >
            <ArrowLeft strokeWidth={1.5} className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            className={buttonClass}
            onClick={() => step(1)}
            disabled={edges.end}
            aria-label={t("next")}
          >
            <ArrowRight strokeWidth={1.5} className="size-5" aria-hidden />
          </button>
        </div>
      </div>
      <ul
        ref={track}
        className="scrollbar-none flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 sm:scroll-px-6 sm:px-6 lg:scroll-px-0 lg:px-0"
      >
        {children}
      </ul>
    </div>
  );
}
