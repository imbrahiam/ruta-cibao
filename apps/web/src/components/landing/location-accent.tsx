import { LocationPin } from "./location-pin";
import styles from "./rotating-headline.module.css";

/** The final punctuation is the location target, not additional icon spacing. */
export function LocationAccent({
  text,
  variant,
}: {
  text: string;
  variant: "classic" | "lollipop";
}) {
  return (
    <span className={styles.locationAccent}>
      <span className={styles.highlight}>
        {text.slice(0, -1)}
        <span className={styles.locationPoint}>
          {text.slice(-1)}
          <span className={styles.locationBadge}>
            <LocationPin variant={variant} />
          </span>
        </span>
      </span>
    </span>
  );
}
