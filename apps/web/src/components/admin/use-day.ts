"use client";

import { useCallback } from "react";
import { useFormatter, useNow } from "use-intl";

/**
 * A calendar day as the desk writes it: "21 nov" within the current year, and
 * with its year ("21 nov 2025") once it falls in another one.
 */
export function useDay() {
  const format = useFormatter();
  const now = useNow();
  return useCallback(
    (date: Date, month: "short" | "long" = "short") => {
      const year = (value: Date) => format.dateTime(value, { year: "numeric" });
      return format.dateTime(date, {
        day: "numeric",
        month,
        ...(year(date) === year(now) ? {} : { year: "numeric" }),
      });
    },
    [format, now],
  );
}
