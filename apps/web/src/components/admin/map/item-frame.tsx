"use client";

import { createContext, type ReactNode, useContext } from "react";

/**
 * How a desk's rows behave when they sit beside a map.
 *
 * Rows read it without knowing about maps: `selectedId` / `onSelect` tie a
 * row to its marker. Outside the map view there is no frame and rows render
 * as they always have.
 */
export type ItemFrame = {
  selectedId: string | null;
  onSelect: (id: string) => void;
};

const ItemFrameContext = createContext<ItemFrame | null>(null);

export function ItemFrameProvider({
  value,
  children,
}: {
  value: ItemFrame;
  children: ReactNode;
}) {
  return (
    <ItemFrameContext.Provider value={value}>
      {children}
    </ItemFrameContext.Provider>
  );
}

export function useItemFrame(): ItemFrame | null {
  return useContext(ItemFrameContext);
}

/** The DOM id a row carries, so a marker can scroll to it. */
export const itemDomId = (id: string) => `queue-item-${id}`;
