"use client";

import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useContext,
  useState,
  useSyncExternalStore,
} from "react";
import { useTranslations } from "use-intl";
import { orpc } from "@/lib/web/api";
import { failureKind } from "@/lib/web/errors";
import { errorMessageKey } from "../error-panel";
import { useOutcome } from "../outcome";
import { type Attempt, useStaffMutation } from "../use-staff-mutation";
import { applyEffect } from "./optimistic";
import type { QueueSlug } from "./slugs";

/** What a decision sends: everything but the id the hook supplies. */
export type Body<T> = Omit<T, "requestId">;

/**
 * Failed decisions, by card. A rolled-back card comes back as a new component,
 * so its error cannot live in the card: it lives here, for the desk's lifetime.
 */
class Failures {
  private errors = new Map<string, Error>();
  private listeners = new Set<() => void>();

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  get(key: string): Error | undefined {
    return this.errors.get(key);
  }

  set(key: string, error: Error) {
    this.errors.set(key, error);
    this.emit();
  }

  clear(key: string) {
    if (this.errors.delete(key)) this.emit();
  }

  private emit() {
    for (const listener of this.listeners) listener();
  }
}

export type Desk = {
  failures: Failures;
  /** One request-id memory per card, outliving the card's own component. */
  attempt: (key: string) => { current: Attempt | null };
};

export const DeskContext = createContext<Desk | null>(null);

function useDesk(): Desk {
  const desk = useContext(DeskContext);
  if (!desk) throw new Error("useDecision needs a queue desk");
  return desk;
}

/** The memory every decision on one desk shares. */
export function useDeskState(): Desk {
  const [desk] = useState<Desk>(() => {
    const attempts = new Map<string, { current: Attempt | null }>();
    return {
      failures: new Failures(),
      attempt: (key) => {
        let held = attempts.get(key);
        if (!held) {
          held = { current: null };
          attempts.set(key, held);
        }
        return held;
      },
    };
  });
  return desk;
}

const DECIDE_KEY = ["desk", "decide"] as const;

/** Everything a decision can change, read again from the server. */
function refetchLists(client: QueryClient) {
  void client.invalidateQueries({ queryKey: orpc.moderation.key() });
  void client.invalidateQueries({ queryKey: orpc.routes.key() });
}

/** The lists a decision touches must not refetch while it is being written. */
async function pauseRefetches(client: QueryClient) {
  const keys = [orpc.moderation.key(), orpc.routes.key()];
  // Cancelling reverts a query to its pre-fetch state, so it has to finish
  // before the optimistic write; with nothing in flight it is skipped, and the
  // write happens in the same task as the click.
  if (keys.some((queryKey) => client.isFetching({ queryKey }) > 0)) {
    await Promise.all(
      keys.map((queryKey) => client.cancelQueries({ queryKey })),
    );
  }
}

/** Which card a decision is on, and what it does to the list. */
export type DecisionTarget<TInput> = {
  queue: QueueSlug;
  id: string;
  /** Tells apart two decisions on one card (a traffic report's text and removal). */
  slot?: string;
  /**
   * Fields the item takes on while it stays in the list. Omitted, or returning
   * `undefined`, the decided item leaves the list.
   */
  patch?: (input: TInput) => Record<string, unknown> | undefined;
};

/**
 * One decision on one card, applied before the server answers.
 *
 * The item leaves its list (or changes) and the sidebar count moves at once;
 * the request follows. If the server refuses, exactly that change is undone
 * and the card returns to its place with the reason. If somebody else decided
 * first (a conflict), or the item is gone, nothing is put back: the lists are
 * refetched and show what is really there. The refetch never delays the confirmation.
 *
 * The request id is kept per card (see `useStaffMutation`), so retrying a
 * decision that came back keeps its id.
 */
export function useDecision<TInput extends object>(
  call: (input: TInput & { requestId: string }) => Promise<unknown>,
  target: DecisionTarget<TInput>,
) {
  const t = useTranslations("admin");
  const announce = useOutcome();
  const queryClient = useQueryClient();
  const desk = useDesk();
  const key = `${target.queue}:${target.id}:${target.slot ?? ""}`;

  const failure = useSyncExternalStore(
    desk.failures.subscribe,
    () => desk.failures.get(key),
    () => undefined,
  );

  const mutation = useStaffMutation<TInput, unknown, () => void>(call, {
    mutationKey: DECIDE_KEY,
    attempt: desk.attempt(key),
    onMutate: async (input) => {
      desk.failures.clear(key);
      await pauseRefetches(queryClient);
      return applyEffect(queryClient, {
        queue: target.queue,
        id: target.id,
        patch: target.patch?.(input),
      });
    },
    onSuccess: () => announce(t("success")),
    onError: (error, _input, undo) => {
      desk.failures.set(key, error);
      const kind = failureKind(error);
      // Somebody else decided it, or it is gone: the card is not coming back,
      // so the words go where they will be seen, and the refetch shows the rest.
      if (kind === "conflict" || kind === "not_found") {
        announce(t(errorMessageKey(error)), "error");
      } else {
        undo?.();
      }
    },
    onSettled: () => {
      // Only the last decision in flight refetches: an earlier answer would
      // bring back a card whose decision is still on its way.
      if (queryClient.isMutating({ mutationKey: DECIDE_KEY }) <= 1) {
        refetchLists(queryClient);
      }
    },
  });

  return {
    decide: (input: TInput) => mutation.mutate(input),
    pending: mutation.isPending,
    error: failure ?? mutation.error,
  };
}
