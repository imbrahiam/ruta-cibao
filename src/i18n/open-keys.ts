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

/**
 * Marks a notification parameter that is itself a catalogue key.
 *
 * Notifications store a key and its parameters rather than a sentence, so that
 * one written today still reads in whatever language the recipient picks
 * tomorrow. That works until a parameter is not data but vocabulary — the name
 * of a state, say — at which point storing the Spanish word for it puts a
 * sentence back in the database through the side door.
 *
 * So a parameter may be a key too, and this prefix is how it says so. It has to
 * be a prefix rather than a guess, because a place really can be called
 * "consultations.status.open" and the platform must not translate its name.
 */
const KEY_PARAM_PREFIX = "@";

export function keyParam(key: string): string {
  return `${KEY_PARAM_PREFIX}${key}`;
}

/**
 * Renders one stored notification.
 *
 * The translator passed in must be rooted at the catalogue, not scoped to a
 * namespace: stored keys are full paths (`notifications.placeApproved`), and a
 * translator scoped to `notifications` would look for
 * `notifications.notifications.placeApproved` and find nothing.
 */
export function renderNotification(
  translator: unknown,
  messageKey: string,
  params: Record<string, string | number> = {},
): string {
  const t = withOpenKeys(translator);

  const resolved: Record<string, string | number> = {};
  for (const [name, value] of Object.entries(params)) {
    resolved[name] =
      typeof value === "string" && value.startsWith(KEY_PARAM_PREFIX)
        ? t(value.slice(KEY_PARAM_PREFIX.length))
        : value;
  }

  return t(messageKey, resolved);
}
