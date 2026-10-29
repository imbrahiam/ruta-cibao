import { LocationPin } from "./location-pin";
import styles from "./rotating-headline.module.css";

/** A small decorative pin replaces the visual acute accent; spoken text stays unchanged. */
export function LocationAccent({
  text,
  variant,
}: {
  text: string;
  variant: "classic" | "lollipop";
}) {
  const accent = text.indexOf("í");
  if (accent < 0) return <span className={styles.highlight}>{text}</span>;
  return (
    <span className={styles.locationAccent}>
      <span className={styles.srOnly}>{text}</span>
      <span className={styles.highlight} aria-hidden="true">
        {text.slice(0, accent)}
        <span className={styles.locationVowel}>
          {"ı"}
          <span className={styles.locationBadge}>
            <LocationPin variant={variant} />
          </span>
        </span>
        {text.slice(accent + 1)}
      </span>
    </span>
  );
}
