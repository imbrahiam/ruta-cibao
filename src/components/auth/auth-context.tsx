"use client";

import { useQuery } from "@tanstack/react-query";
import { createContext, useContext } from "react";
import { type client, orpc } from "@/lib/orpc";

type Viewer = Awaited<ReturnType<typeof client.me.get>>;

type AuthContextValue = {
  viewer: Viewer | undefined;
  isLoading: boolean;
  isUnavailable: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const query = useQuery(orpc.me.get.queryOptions());

  return (
    <AuthContext.Provider
      value={{
        viewer: query.data,
        isLoading: query.isPending,
        isUnavailable: query.isError,
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
