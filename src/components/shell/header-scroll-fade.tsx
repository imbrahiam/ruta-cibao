"use client";

import { useEffect, useState } from "react";

/**
 * A soft fade under the sticky header, once the page moves.
 *
 * The header itself has no border anymore, so without this the content slides
 * under it with a hard edge. The gradient eases that cut: invisible at the
 * top of the page, fading in past a few pixels of scroll. One boolean in
 * state, flipped by a passive listener — no scroll timeline, since the header
 * is not the thing scrolling.
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
      className="pointer-events-none absolute inset-x-0 top-full h-8 bg-gradient-to-b from-background to-transparent opacity-0 transition-opacity duration-300 data-[scrolled=true]:opacity-100"
    />
  );
}
