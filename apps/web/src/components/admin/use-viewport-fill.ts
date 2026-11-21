"use client";

import {
  type CSSProperties,
  type RefObject,
  useLayoutEffect,
  useState,
} from "react";

/**
 * The height left in the window below `element` when the page is at its top,
 * as the `--desk-fill` variable: the list takes exactly the rest of the
 * screen, so nothing below it pushes the page into scrolling. Re-measured when
 * the window or anything above it (a wrapping toolbar) changes size.
 *
 * The height runs to the window's bottom edge, through the page's bottom
 * padding, which `--desk-bleed` holds: give the element `-mb-(--desk-bleed)`
 * so the page keeps its height, and its scrollers `pb-(--desk-bleed)` so
 * their last item still clears the edge when scrolled to the end. The space
 * below a short list is then the list's, not a band that cuts it off.
 */
export function useViewportFill(
  element: RefObject<HTMLElement | null>,
): CSSProperties | undefined {
  const [height, setHeight] = useState<number | null>(null);
  const [bleed, setBleed] = useState(0);
  useLayoutEffect(() => {
    const node = element.current;
    if (!node) return;
    const measure = () => {
      const main = node.closest("main#contenido");
      const bottom = main
        ? Number.parseFloat(getComputedStyle(main).paddingBottom) || 0
        : 0;
      const top = node.getBoundingClientRect().top + window.scrollY;
      setHeight(Math.round(window.innerHeight - top));
      setBleed(Math.round(bottom));
    };
    measure();
    window.addEventListener("resize", measure);
    const observer = new ResizeObserver(measure);
    for (const sibling of node.parentElement?.children ?? []) {
      if (sibling !== node) observer.observe(sibling);
    }
    return () => {
      window.removeEventListener("resize", measure);
      observer.disconnect();
    };
  }, [element]);
  return height === null
    ? undefined
    : ({
        "--desk-fill": `${height}px`,
        "--desk-bleed": `${bleed}px`,
      } as CSSProperties);
}
