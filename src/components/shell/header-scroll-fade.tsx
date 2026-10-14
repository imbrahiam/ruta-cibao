"use client";

import { useEffect, useState } from "react";

/**
 * A hairline under the sticky header, once the page moves.
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
      className="pointer-events-none absolute inset-x-0 top-full h-px bg-border opacity-0 transition-opacity duration-200 data-[scrolled=true]:opacity-100"
    />
  );
}
