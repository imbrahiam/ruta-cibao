import { MapPin } from "lucide-react";
import styles from "./municipality-cards.module.css";

type MunicipalityCardsProps = {
  municipalities: readonly [
    { name: string; description: string },
    { name: string; description: string },
    { name: string; description: string },
  ];
};

const COMPOSITIONS = [
  {
    index: 0,
    theme: "sage",
    route: "M-10 122 C43 122 44 45 100 59 S156 143 204 93 S250 39 310 61",
    secondary: "M48 -10 C48 30 118 34 124 88 S105 154 166 195",
  },
  {
    index: 1,
    theme: "lavender",
    route: "M-10 67 C37 29 74 39 99 86 S133 147 187 109 S251 65 309 116",
    secondary: "M193 -10 C160 35 207 54 199 96 S156 151 195 196",
  },
  {
    index: 2,
    theme: "butter",
    route: "M-10 144 C54 166 48 86 111 87 S178 32 213 54 S254 110 311 72",
    secondary: "M76 -10 C102 38 61 55 98 96 S151 133 130 195",
  },
] as const;

/** Original paper collages, deliberately not geographic representations. */
export function MunicipalityCards({ municipalities }: MunicipalityCardsProps) {
  return (
    <div className={styles.collection}>
      <ul className={styles.cards}>
        {COMPOSITIONS.map((composition) => {
          const { index } = composition;
          const municipality = municipalities[index];
          return (
            <li
              key={municipality.name}
              className={`${styles.card} ${styles[composition.theme]}`}
            >
              <div className={styles.art} aria-hidden="true">
                <span className={styles.backing} />
                <div className={styles.sheet}>
                  <svg viewBox="0 0 300 180" fill="none" aria-hidden="true">
                    <path
                      d="M24 0V180M87 0V180M150 0V180M213 0V180M276 0V180M0 30H300M0 90H300M0 150H300"
                      className={styles.grid}
                    />
                    <path
                      d={composition.secondary}
                      className={styles.secondaryPath}
                    />
                    <path d={composition.route} className={styles.routeEdge} />
                    <path d={composition.route} className={styles.route} />
                    <circle cx="55" cy="92" r="5" className={styles.dot} />
                    <circle cx="236" cy="69" r="4" className={styles.dot} />
                  </svg>
                </div>
                <span className={styles.tape} />
                <span className={styles.pin}>
                  <MapPin size={25} strokeWidth={1.5} />
                </span>
                <span className={styles.ticket}>
                  <span />
                  <span />
                  <span />
                </span>
                <span className={styles.number}>0{index + 1}</span>
              </div>
              <div className={styles.copy}>
                <h3>{municipality.name}</h3>
                <p>{municipality.description}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
