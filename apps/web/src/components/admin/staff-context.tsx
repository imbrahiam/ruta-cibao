"use client";

import type { MeOutput } from "@ruta/contracts";
import { createContext, useContext } from "react";

/** The signed-in staff member, as `me.get` described them. */
export type Staff = MeOutput & { staffRole: "moderator" | "admin" };

const StaffContext = createContext<Staff | null>(null);

export const StaffProvider = StaffContext.Provider;

export function useStaff(): Staff {
  const staff = useContext(StaffContext);
  if (!staff) throw new Error("useStaff needs <StaffProvider>");
  return staff;
}
