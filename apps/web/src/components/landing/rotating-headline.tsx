"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState, useSyncExternalStore } from "react";
import styles from "./rotating-headline.module.css";

type RotatingHeadlineProps = {
  prefix: string;
  phrases: readonly [string, string, string];
  lead: string;
  highlight: string;
};

const MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeToMotionPreference(onChange: () => void) {
  const query = window.matchMedia(MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function getMotionPreference() {
  return window.matchMedia(MOTION_QUERY).matches;
}

function getServerMotionPreference() {
  return true;
}

export function RotatingHeadline({
  prefix,
  phrases,
  lead,
  highlight,
}: RotatingHeadlineProps) {
  const [index, setIndex] = useState(0);
  const reducedMotion = useSyncExternalStore(
    subscribeToMotionPreference,
    getMotionPreference,
    getServerMotionPreference,
  );

  useEffect(() => {
    // Wait for the browser preference before starting; SSR always shows phrase 0.
    if (reducedMotion) return;

    let timer: number | undefined;
    const stop = () => {
      window.clearInterval(timer);
      timer = undefined;
    };
    const syncVisibility = () => {
      stop();
      if (document.visibilityState !== "visible") return;
      timer = window.setInterval(() => {
        if (document.visibilityState === "visible") {
          setIndex((current) => (current + 1) % phrases.length);
        }
      }, 3600);
    };

    syncVisibility();
    document.addEventListener("visibilitychange", syncVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", syncVisibility);
    };
  }, [phrases.length, reducedMotion]);

  const shownIndex = reducedMotion ? 0 : index;

  return (
    <div className={styles.heading}>
      <h1 id="hero-title" className={styles.title}>
        <span className={styles.srOnly}>
          {prefix} {phrases[0]} {lead} {highlight}
        </span>
        <span aria-hidden="true">
          <span className={styles.firstLine}>
            <span>{prefix}</span>
            <span className={styles.rotator}>
              {phrases.map((phrase) => (
                <span key={phrase} className={styles.measure}>
                  {phrase}
                </span>
              ))}
              <AnimatePresence initial={false}>
                <motion.span
                  key={shownIndex}
                  className={styles.phrase}
                  initial={{ opacity: 0, y: "24%" }}
                  animate={{ opacity: 1, y: "0%" }}
                  exit={{ opacity: 0, y: "-24%" }}
                  transition={{ duration: reducedMotion ? 0 : 0.32 }}
                >
                  {phrases[shownIndex]}
                </motion.span>
              </AnimatePresence>
            </span>
          </span>
          <span className={styles.secondLine}>
            {lead} <span className={styles.highlight}>{highlight}</span>
          </span>
        </span>
      </h1>
    </div>
  );
}
