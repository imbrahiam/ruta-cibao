"use client";

import { useCallback } from "react";

/**
 * Puts text on the clipboard; resolves to whether it worked. The async API
 * needs a secure context, so a desk opened over plain http on a LAN address
 * falls back to a selected, off-screen textarea.
 */
export function useCopy(): (text: string) => Promise<boolean> {
  return useCallback(async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const field = document.createElement("textarea");
      field.value = text;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.append(field);
      field.select();
      try {
        return document.execCommand("copy");
      } catch {
        return false;
      } finally {
        field.remove();
      }
    }
  }, []);
}
