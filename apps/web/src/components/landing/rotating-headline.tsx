import styles from "./rotating-headline.module.css";
import { RotatingWord } from "./rotating-word";

type RotatingHeadlineProps = {
  prefix: string;
  phrases: readonly [string, string, string];
  lead: string;
  highlight: string;
};

export function RotatingHeadline({
  prefix,
  phrases,
  lead,
  highlight,
}: RotatingHeadlineProps) {
  return (
    <div className={styles.heading}>
      <h1 id="hero-title" className={styles.title}>
        <span className={styles.srOnly}>
          {prefix} {phrases[0]} {lead} {highlight}
        </span>
        <span aria-hidden="true">
          <span className={styles.firstLine}>
            <span>{prefix}</span>
            <RotatingWord phrases={phrases} />
          </span>
          <span className={styles.secondLine}>
            {lead} <span className={styles.highlight}>{highlight}</span>
          </span>
        </span>
      </h1>
    </div>
  );
}

export function RouteHeadline({
  firstLine,
  lead,
  phrases,
  tone,
}: {
  firstLine: string;
  lead: string;
  phrases: readonly [string, string, string];
  tone: "pine" | "yellow";
}) {
  return (
    <>
      <span className={styles.srOnly}>
        {firstLine} {lead} {phrases[0]}
      </span>
      <span aria-hidden="true">
        <span className={styles.routeFirstLine}>{firstLine}</span>
        <span className={styles.routeSecondLine}>
          <span>{lead}</span>
          <RotatingWord
            phrases={phrases}
            tone={tone}
            className={styles.routeWord}
          />
        </span>
      </span>
    </>
  );
}
