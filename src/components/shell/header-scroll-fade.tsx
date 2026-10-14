"use client";

import { useEffect, useState } from "react";

/**
 * A soft fade under the sticky header, once the page moves.
 *
 * At the top of the page the header and the page are one surface; once the
 * content slides under it, a rule separates them — by line, not shadow, as
 * every page surface does. One boolean in state, flipped by a passive
 * listener: no scroll timeline, since the header is not the thing scrolling.
 */
export function HeaderScrollFade() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () =>
      setScrolled((was) => {
        const is = window.scrollY > 8;
        return is === was ? was : is;
      });
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      aria-hidden
      data-scrolled={scrolled}
      // A fade rather than a rule: the content dissolves under the header as it
      // scrolls, instead of being cut by a line — the edge reads as depth, the
      // way the page meets the header on the landing.
      className="pointer-events-none absolute inset-x-0 top-full h-5 bg-linear-to-b from-background via-background/70 to-transparent opacity-0 transition-opacity duration-200 data-[scrolled=true]:opacity-100"
    />
  );
}
