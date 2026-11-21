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
 */
export function useViewportFill(
  element: RefObject<HTMLElement | null>,
): CSSProperties | undefined {
  const [height, setHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    const node = element.current;
    if (!node) return;
    const measure = () => {
      const main = node.closest("main#contenido");
      const bottom = main
        ? Number.parseFloat(getComputedStyle(main).paddingBottom) || 0
        : 0;
      const top = node.getBoundingClientRect().top + window.scrollY;
      setHeight(Math.round(window.innerHeight - top - bottom));
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
    : ({ "--desk-fill": `${height}px` } as CSSProperties);
}
