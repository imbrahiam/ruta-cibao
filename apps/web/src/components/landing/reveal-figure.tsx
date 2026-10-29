"use client";

import { scroll } from "motion";
import {
  type AnimationPlaybackControls,
  motion,
  useAnimate,
  useInView,
  useMotionValue,
  useSpring,
} from "motion/react";
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

/** Visible on the server; desktop depth and idle movement stop outside the viewport. */
export function RevealFigure({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const [scope, animate] = useAnimate<HTMLElement>();
  const inView = useInView(scope, { once: true, amount: 0.18 });
  const visible = useInView(scope, { amount: 0 });
  const depth = useMotionValue(0);
  const smoothDepth = useSpring(depth, {
    stiffness: 90,
    damping: 25,
    mass: 0.6,
  });
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
      { opacity: [0.72, 1] },
      { duration: 0.65, ease: [0.22, 1, 0.36, 1] },
    );
    return () => {
      entry.stop();
      figure.style.removeProperty("opacity");
    };
  }, [animate, enabled, inView, scope]);

  useEffect(() => {
    const figure = scope.current;
    if (!figure || !enabled || !visible) return;
    let idle: AnimationPlaybackControls | undefined;
    let stopScroll: (() => void) | undefined;
    const stop = () => {
      idle?.stop();
      stopScroll?.();
      idle = undefined;
      stopScroll = undefined;
      figure.style.removeProperty("--idle-y");
      depth.jump(0);
      smoothDepth.jump(0);
    };
    const syncVisibility = () => {
      stop();
      if (document.hidden) return;
      idle = animate(
        figure,
        { "--idle-y": ["0px", "-7px", "0px"] },
        { duration: 5.6, repeat: Infinity, ease: "easeInOut" },
      );
      stopScroll = scroll((progress) => depth.set(18 - progress * 36), {
        target: figure,
        offset: ["start end", "end start"],
      });
    };
    syncVisibility();
    document.addEventListener("visibilitychange", syncVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", syncVisibility);
    };
  }, [animate, depth, enabled, scope, smoothDepth, visible]);

  return (
    <motion.figure
      ref={scope}
      className={className}
      style={{ y: enabled ? smoothDepth : 0 }}
    >
      {children}
    </motion.figure>
  );
}
