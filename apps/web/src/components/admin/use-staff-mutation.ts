"use client";

import {
  type MutationKey,
  type UseMutationResult,
  useMutation,
} from "@tanstack/react-query";
import { useRef } from "react";

/** The request id a payload went out under, kept until the action lands. */
export type Attempt = { key: string; requestId: string };

type Options<TInput, TOutput, TContext> = {
  mutationKey?: MutationKey;
  /**
   * Where the attempt is remembered. Defaults to the calling component; a card
   * that unmounts while its decision is optimistic passes a longer-lived one so
   * that retrying a rolled-back decision still reuses its request id.
   */
  attempt?: { current: Attempt | null };
  /** Runs before the request: the place for optimistic cache writes. */
  onMutate?: (input: TInput) => TContext | Promise<TContext>;
  onSuccess?: (
    output: TOutput,
    input: TInput,
    context: TContext | undefined,
  ) => void | Promise<void>;
  onError?: (
    error: Error,
    input: TInput,
    context: TContext | undefined,
  ) => void | Promise<void>;
  onSettled?: (
    output: TOutput | undefined,
    error: Error | null,
    input: TInput,
    context: TContext | undefined,
  ) => void | Promise<void>;
};

/**
 * A staff action with a stable request id.
 *
 * Every mutation in the contract is idempotent on `requestId`, so a retry after
 * a lost response must reuse the id it first sent, and an edited payload must
 * not (the server refuses a changed payload under the same id). The id is kept
 * for as long as the payload is unchanged and dropped once the action lands.
 *
 * While `isPending` is true the caller disables its button: the one place a
 * double submit is prevented.
 */
export function useStaffMutation<
  TInput extends object,
  TOutput,
  TContext = undefined,
>(
  call: (input: TInput & { requestId: string }) => Promise<TOutput>,
  options: Options<TInput, TOutput, TContext> = {},
): UseMutationResult<TOutput, Error, TInput, TContext> {
  const local = useRef<Attempt | null>(null);
  const attempt = options.attempt ?? local;

  return useMutation<TOutput, Error, TInput, TContext>({
    mutationKey: options.mutationKey,
    mutationFn: async (input) => {
      const key = JSON.stringify(input);
      if (attempt.current?.key !== key) {
        attempt.current = { key, requestId: crypto.randomUUID() };
      }
      const output = await call({
        ...input,
        requestId: attempt.current.requestId,
      });
      attempt.current = null;
      return output;
    },
    onMutate: async (input) => {
      // No connection: say so before changing anything on screen. The error
      // reads like any lost request (see `failureKind`), and nothing is sent.
      if (!navigator.onLine) throw new TypeError("offline");
      return (await options.onMutate?.(input)) as TContext;
    },
    onSuccess: options.onSuccess,
    onError: options.onError,
    onSettled: options.onSettled,
  });
}
