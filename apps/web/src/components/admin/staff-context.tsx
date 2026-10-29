"use client";

import type { MeOutput } from "@ruta/contracts";
import { createContext, useContext } from "react";

/** The signed-in staff member, as `me.get` described them. */
export type Staff = MeOutput & {
  kind: "member";
  contactVerified: true;
} & (
    | { staffRole: "admin"; staffScope: "all" }
    | { staffRole: "moderator"; staffScope: string[] }
  );

export function isStaffViewer(viewer: MeOutput): viewer is Staff {
  if (viewer.kind !== "member" || !viewer.contactVerified) return false;
  return (
    (viewer.staffRole === "admin" && viewer.staffScope === "all") ||
    (viewer.staffRole === "moderator" &&
      Array.isArray(viewer.staffScope) &&
      viewer.staffScope.length > 0)
  );
}

const StaffContext = createContext<Staff | null>(null);

export const StaffProvider = StaffContext.Provider;

export function useStaff(): Staff {
  const staff = useContext(StaffContext);
  if (!staff) throw new Error("useStaff needs <StaffProvider>");
  return staff;
}
