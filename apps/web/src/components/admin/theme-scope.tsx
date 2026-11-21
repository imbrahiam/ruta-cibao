"use client";

import { type ReactNode, useEffect } from "react";
import { Canvas } from "@/components/canvas-tone";

/**
 * Scopes the staff-desk tokens (`.admin` in globals.css) to this subtree and,
 * while it is mounted, to `<html>`, so portalled menus, dialogs and tooltips
 * and the overscroll canvas share the desk's colours.
 */
export function AdminThemeScope({ children }: { children: ReactNode }) {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("admin");
    return () => root.classList.remove("admin");
  }, []);

  return (
    <div className="admin min-h-dvh" data-canvas-surface>
      {/* The sidebar's own grey reaches past the edges (globals.css). */}
      <Canvas />
      {children}
    </div>
  );
}
