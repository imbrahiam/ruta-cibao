"use client";

import { useAnimate, useInView } from "motion/react";
import { type ReactNode, useEffect, useSyncExternalStore } from "react";

const DESKTOP_MOTION =
  "(min-width: 801px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)";

function subscribeToDesktopMotion(onChange: () => void) {
  const query = window.matchMedia(DESKTOP_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function desktopMotionEnabled() {
  return window.matchMedia(DESKTOP_MOTION).matches;
}

function serverMotionEnabled() {
  return false;
}

/** Content remains visible before hydration; each scene settles once on entry. */
export function RevealFigure({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const [scope, animate] = useAnimate<HTMLElement>();
  const inView = useInView(scope, { once: true, amount: 0.18 });
  const enabled = useSyncExternalStore(
    subscribeToDesktopMotion,
    desktopMotionEnabled,
    serverMotionEnabled,
  );

  useEffect(() => {
    const figure = scope.current;
    if (!figure || !inView || !enabled) return;
    const entry = animate(
      figure,
      { opacity: [0.72, 1], y: [16, 0] },
      { duration: 0.65, ease: [0.22, 1, 0.36, 1] },
    );
    return () => {
      entry.stop();
      figure.style.removeProperty("opacity");
      figure.style.removeProperty("transform");
    };
  }, [animate, enabled, inView, scope]);

  return (
    <figure ref={scope} className={className}>
      {children}
    </figure>
  );
}
