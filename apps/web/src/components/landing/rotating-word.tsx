"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import styles from "./rotating-word.module.css";

type RotatingWordProps = {
  phrases: readonly [string, string, string];
  tone?: "lavender" | "yellow";
  className?: string;
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

export function RotatingWord({
  phrases,
  tone = "lavender",
  className,
}: RotatingWordProps) {
  const [index, setIndex] = useState(0);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState<number | null>(null);
  const reducedMotion = useSyncExternalStore(
    subscribeToMotionPreference,
    getMotionPreference,
    getServerMotionPreference,
  );

  useEffect(() => {
    const measure = measureRef.current;
    if (!measure) return;
    const observer = new ResizeObserver(() => {
      setWidth(measure.getBoundingClientRect().width);
    });
    observer.observe(measure);
    return () => observer.disconnect();
  }, []);

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
      }, 2000);
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
    <motion.span
      className={`${styles.rotator} ${tone === "yellow" ? styles.yellow : ""} ${className ?? ""}`}
      initial={false}
      animate={{ width: width ?? "auto" }}
      transition={{
        duration: reducedMotion ? 0 : 0.56,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <span ref={measureRef} className={styles.measure}>
        {phrases[shownIndex]}
      </span>
      <AnimatePresence initial={false}>
        <motion.span
          key={shownIndex}
          className={styles.phrase}
          initial={{ opacity: 0, y: "0.2em", filter: "blur(0.08em)" }}
          animate={{ opacity: 1, y: "0em", filter: "blur(0em)" }}
          exit={{
            opacity: 0,
            y: "-0.2em",
            filter: "blur(0.08em)",
            transition: { duration: reducedMotion ? 0 : 0.24 },
          }}
          transition={{
            duration: reducedMotion ? 0 : 0.44,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          {phrases[shownIndex]}
        </motion.span>
      </AnimatePresence>
      <motion.svg
        key={shownIndex}
        className={styles.underline}
        viewBox="0 0 100 10"
        preserveAspectRatio="none"
        fill="none"
        aria-hidden="true"
        initial={{
          clipPath: reducedMotion ? "inset(0 0% 0 0)" : "inset(0 100% 0 0)",
        }}
        animate={{ clipPath: "inset(0 0% 0 0)" }}
        transition={{
          duration: reducedMotion ? 0 : 0.44,
          delay: reducedMotion ? 0 : 0.12,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        <path
          d="M2 6 Q50 3 98 5"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </motion.svg>
    </motion.span>
  );
}
