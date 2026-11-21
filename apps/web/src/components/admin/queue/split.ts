import { createContext, useContext } from "react";

/**
 * Which item of a queue worked as "list beside the selected item" is open.
 * `null` outside such a queue, so a compact line can tell it is in one.
 */
export const SplitContext = createContext<{
  selected: string | null;
  select: (key: string) => void;
} | null>(null);

export function useSplit() {
  return useContext(SplitContext);
}
