/** GPS is a proximity signal for a souvenir, never proof of identity. */
export const VISIT_RADIUS_METERS = 150;
export const MAX_ACCURACY_METERS = 100;
export const MAX_FIX_AGE_MS = 60_000;

export function visitProblem(
  fix: { accuracyMeters: number; capturedAt: string },
  now = Date.now(),
): "inaccurate" | "stale" | null {
  if (fix.accuracyMeters > MAX_ACCURACY_METERS) return "inaccurate";
  const age = now - Date.parse(fix.capturedAt);
  if (!Number.isFinite(age) || age > MAX_FIX_AGE_MS || age < -5000)
    return "stale";
  return null;
}
