import { useFormatter, useNow, useTranslations } from "use-intl";

/**
 * "hace 3 horas" up to a week, then the date. Hermes has no
 * Intl.RelativeTimeFormat, so the phrasing comes from the catalogue.
 */
export function useAgo() {
  const t = useTranslations("time");
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  return (value: string | Date) => {
    const date = typeof value === "string" ? new Date(value) : value;
    const minutes = Math.max(
      0,
      Math.round((now.getTime() - date.getTime()) / 60_000),
    );
    if (minutes < 1) return t("now");
    if (minutes < 60) return t("minutes", { count: minutes });
    const hours = Math.round(minutes / 60);
    if (hours < 24) return t("hours", { count: hours });
    const days = Math.round(hours / 24);
    if (days < 7) return t("days", { count: days });
    return format.dateTime(date, "short");
  };
}
