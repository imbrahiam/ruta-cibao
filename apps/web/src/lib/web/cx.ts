type ClassValue = string | false | null | undefined | 0;

/** Joins the truthy class names. No merging: components avoid conflicts instead. */
export function cx(...values: ClassValue[]): string {
  return values.filter(Boolean).join(" ");
}
