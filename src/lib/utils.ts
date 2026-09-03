/**
 * Class name merging.
 *
 * `cn` replaces the usual `clsx` + `tailwind-merge` pair with one engine that
 * does both. The API is identical, so nothing that calls it had to change.
 *
 * The reason is that this is a hot path rather than a preference: `cn()` runs
 * on every render of every component, and a map screen renders hundreds of
 * markers and list rows at once. Its own benchmarks put it around 30× faster
 * than the two-library combination on typical component input.
 *
 * One thing to know: it resolves conflicts from the classes it can see in the
 * source, so a class assembled at runtime — `"p-" + size` — is invisible to it.
 * Write the whole class name in every branch, which is the Tailwind rule
 * anyway.
 */

export type { ClassValue } from "cn";
export { cn } from "cn";
