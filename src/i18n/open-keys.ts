/**
 * A translator for keys that cannot be known at compile time.
 *
 * next-intl types `t` against the catalogue, which is exactly right for the
 * text a component writes itself. Notification keys are different: they are
 * stored in the database and each feature adds its own, so the set is open and
 * no generated type can cover it.
 *
 * Rather than reach for `any` at every call site, the escape hatch lives here,
 * once, with a name. A key that is missing from the catalogue renders as the
 * key itself, which is loud enough to catch in review.
 */
export type OpenTranslator = (
  key: string,
  values?: Record<string, string | number>,
) => string;

export function withOpenKeys(translator: unknown): OpenTranslator {
  return translator as OpenTranslator;
}
