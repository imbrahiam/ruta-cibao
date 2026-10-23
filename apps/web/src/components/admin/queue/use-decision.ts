"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  type RefObject,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslations } from "use-intl";
import { orpc } from "@/lib/web/api";
import { failureKind } from "@/lib/web/errors";
import { useOutcome } from "../outcome";
import { useStaffMutation } from "../use-staff-mutation";

/** What a decision sends: everything but the id the hook supplies. */
export type Body<T> = Omit<T, "requestId">;

type Desk = {
  /** Refetch whatever the decision may have changed. */
  settle: () => Promise<void>;
  /** Put keyboard focus back on the list once the decided card is gone. */
  restoreFocus: () => void;
};

export const DeskContext = createContext<Desk | null>(null);

function useDesk(): Desk {
  const desk = useContext(DeskContext);
  if (!desk) throw new Error("useDecision needs a queue desk");
  return desk;
}

/** The refetch and focus behaviour every decision on the desk shares. */
export function useDeskActions(listRef: RefObject<HTMLElement | null>): Desk {
  const queryClient = useQueryClient();

  return useMemo(
    () => ({
      settle: async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: orpc.moderation.key() }),
          queryClient.invalidateQueries({ queryKey: orpc.routes.key() }),
        ]);
      },
      restoreFocus: () => {
        // A removed card takes focus with it; only step in when it fell to
        // the page, never when the reviewer has already moved on.
        const active = document.activeElement;
        if (active && active !== document.body) return;
        listRef.current?.focus({ preventScroll: true });
      },
    }),
    [queryClient, listRef],
  );
}

/**
 * One decision on one card.
 *
 * The mutation keeps one request id per payload (see `useStaffMutation`), stays
 * pending until the lists have refetched so the buttons cannot be pressed
 * twice, and locks the card afterwards: if the refetch still lists it, it reads
 * as decided instead of offering the same choice again.
 */
export function useDecision<TInput extends object>(
  call: (input: TInput & { requestId: string }) => Promise<unknown>,
) {
  const t = useTranslations("admin");
  const announce = useOutcome();
  const desk = useDesk();
  const [decided, setDecided] = useState(false);
  const focusOnRemoval = useRef(false);

  useEffect(
    () => () => {
      if (focusOnRemoval.current) desk.restoreFocus();
    },
    [desk],
  );

  const mutation = useStaffMutation<TInput, unknown>(call, {
    onSuccess: async () => {
      announce(t("success"));
      setDecided(true);
      focusOnRemoval.current = true;
      await desk.settle();
    },
  });

  const decide = (input: TInput) =>
    mutation.mutate(input, {
      onError: (error) => {
        // Somebody else got there first: show their decision, not ours.
        if (failureKind(error) === "conflict") void desk.settle();
      },
    });

  return {
    decide,
    pending: mutation.isPending,
    error: mutation.error,
    decided,
  };
}
