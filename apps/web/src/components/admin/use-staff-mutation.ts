"use client";

import { type UseMutationResult, useMutation } from "@tanstack/react-query";
import { useRef } from "react";

type Options<TInput, TOutput> = {
  onSuccess?: (output: TOutput, input: TInput) => void | Promise<void>;
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
export function useStaffMutation<TInput extends object, TOutput>(
  call: (input: TInput & { requestId: string }) => Promise<TOutput>,
  options: Options<TInput, TOutput> = {},
): UseMutationResult<TOutput, Error, TInput> {
  const attempt = useRef<{ key: string; requestId: string } | null>(null);

  return useMutation<TOutput, Error, TInput>({
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
    onSuccess: options.onSuccess,
  });
}
