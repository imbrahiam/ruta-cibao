"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

const SURFACE = "[data-canvas-surface]";

/** Every `theme-color` meta (Next may render one per colour scheme). */
function themeMetas(): HTMLMetaElement[] {
  const metas = [
    ...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'),
  ];
  if (metas.length > 0) return metas;
  const meta = document.createElement("meta");
  meta.name = "theme-color";
  document.head.append(meta);
  return [meta];
}

/**
 * Names the surface of the layout it sits in as the root canvas, which is
 * what rubber-band scrolling shows past the page's edges and what Safari tints
 * its toolbar with (through `theme-color`).
 *
 * A stylesheet rule alone cannot do this: after an in-app navigation Next
 * keeps the previous route in the document, hidden, so a `:has()` on the root
 * would still match the page that was left. The visible layout says which
 * surface it is, from a layout effect, and names it again when the theme
 * changes (the device's scheme, or a theme the viewer chose).
 */
export function Canvas() {
  const marker = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const surface = marker.current?.closest<HTMLElement>(SURFACE);
    if (!surface) return;
    const root = document.documentElement;
    let applied = "";
    const apply = () => {
      applied = getComputedStyle(surface).backgroundColor;
      root.style.setProperty("--canvas", applied);
      for (const meta of themeMetas()) meta.content = applied;
    };
    apply();
    const scheme = window.matchMedia("(prefers-color-scheme: dark)");
    scheme.addEventListener("change", apply);
    // On a client navigation Next swaps the route's `theme-color` tags in after
    // this ran; they would win over the surface, so name it again.
    const head = new MutationObserver(apply);
    head.observe(document.head, { childList: true });
    // A theme chosen in the page changes colours without any navigation.
    const attributes = new MutationObserver(apply);
    attributes.observe(root, {
      attributes: true,
      attributeFilter: ["data-admin-theme", "class"],
    });
    return () => {
      head.disconnect();
      attributes.disconnect();
      scheme.removeEventListener("change", apply);
      // The layout that replaced this one may already have named its own.
      if (root.style.getPropertyValue("--canvas") === applied) {
        root.style.removeProperty("--canvas");
      }
    };
  }, []);
  return <span ref={marker} hidden />;
}

/**
 * Towards the end of the page the canvas takes the colour of the element with
 * this id (the footer), so pulling past the end stretches the footer; towards
 * the start it keeps the page's surface, so pulling down at the top stretches
 * the header. The switch follows the scroll position (past the middle); on a
 * page too short to scroll, the direction of the last wheel or touch gesture
 * decides. Only the colour changes: the bounce, and with it pull-to-refresh,
 * is left alone (no `overscroll-behavior`).
 */
export function CanvasTone({ of }: { of: string }) {
  useEffect(() => {
    const element = document.getElementById(of);
    if (!element) return;
    const root = document.documentElement;
    const tone = () => {
      const color = getComputedStyle(element).backgroundColor;
      // A transparent footer shows the page's surface: nothing to switch to.
      return color === "rgba(0, 0, 0, 0)" || color === "transparent"
        ? null
        : color;
    };
    let towardsEnd = false;
    let touchY = 0;
    const update = () => {
      const color = tone();
      const reach = root.scrollHeight - window.innerHeight;
      const atEnd = reach > 1 ? window.scrollY > reach / 2 : towardsEnd;
      if (color && atEnd) root.style.setProperty("--canvas-tone", color);
      else root.style.removeProperty("--canvas-tone");
    };
    const wheel = (event: WheelEvent) => {
      if (event.deltaY === 0) return;
      towardsEnd = event.deltaY > 0;
      update();
    };
    const touchStart = (event: TouchEvent) => {
      touchY = event.touches[0]?.clientY ?? 0;
    };
    const touchMove = (event: TouchEvent) => {
      const y = event.touches[0]?.clientY ?? touchY;
      if (y === touchY) return;
      towardsEnd = y < touchY;
      touchY = y;
      update();
    };
    update();
    const passive = { passive: true } as const;
    window.addEventListener("scroll", update, passive);
    window.addEventListener("resize", update);
    window.addEventListener("wheel", wheel, passive);
    window.addEventListener("touchstart", touchStart, passive);
    window.addEventListener("touchmove", touchMove, passive);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("wheel", wheel);
      window.removeEventListener("touchstart", touchStart);
      window.removeEventListener("touchmove", touchMove);
      root.style.removeProperty("--canvas-tone");
    };
  }, [of]);
  return null;
}
