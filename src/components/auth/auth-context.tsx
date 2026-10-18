"use client";

import { useQuery } from "@tanstack/react-query";
import { createContext, type ReactNode, useContext } from "react";
import { type client, orpc } from "@/lib/orpc";

export type Viewer = Awaited<ReturnType<typeof client.me.get>>;

type AuthContextValue = {
  viewer: Viewer | undefined;
  isLoading: boolean;
  isSignedIn: boolean;
  isCitizen: boolean;
  isStaff: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Who is looking, fetched once per session and shared.
 *
 * Every screen reads the same `me.get` query, so a sign-in or a verified
 * cédula updates the whole shell by invalidating one key.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const query = useQuery(orpc.me.get.queryOptions());
  const viewer = query.data;

  return (
    <AuthContext.Provider
      value={{
        viewer,
        isLoading: query.isPending,
        isSignedIn: viewer !== undefined && viewer.kind !== "anonymous",
        isCitizen: viewer?.kind === "citizen",
        isStaff: viewer !== undefined && viewer.staffRole !== "none",
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider.");
  return context;
}
