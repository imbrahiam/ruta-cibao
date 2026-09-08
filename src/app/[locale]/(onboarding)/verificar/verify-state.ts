/**
 * The outcome of the cédula step, shared between the Server Action that
 * produces it and the client form that renders it.
 *
 * Lives here rather than in `actions.ts` because a `"use server"` module may
 * only export async functions — a plain object export fails the build.
 */
export type VerifyState = {
  status: "idle" | "verified" | "pending" | "rejected" | "taken" | "invalid";
  message: string | null;
};

export const initialVerifyState: VerifyState = {
  status: "idle",
  message: null,
};
