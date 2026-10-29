"use client";

import { motion, useReducedMotion } from "motion/react";
import { type ReactNode, useId, useState } from "react";
import styles from "./page.module.css";

export function FaqItem({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const reducedMotion = useReducedMotion();

  return (
    <article className={styles.question}>
      <h3>
        <button
          type="button"
          id={`${id}-trigger`}
          className={styles.questionTrigger}
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((current) => !current)}
        >
          {title}
          <span className={styles.toggle} aria-hidden="true" />
        </button>
      </h3>
      <motion.div
        id={id}
        role="region"
        aria-labelledby={`${id}-trigger`}
        aria-hidden={!open}
        inert={!open}
        className={styles.answerFrame}
        initial={false}
        animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
        transition={{
          height: {
            duration: reducedMotion ? 0 : 0.36,
            ease: [0.22, 1, 0.36, 1],
          },
          opacity: { duration: reducedMotion ? 0 : 0.2 },
        }}
      >
        <div className={styles.answer}>{children}</div>
      </motion.div>
    </article>
  );
}
