"use client";

import { createContext, useContext, useEffect, useState } from "react";

interface InstallPromptEvent extends Event {
  prompt(): Promise<unknown>;
}

type InstallState = {
  available: boolean;
  installed: boolean;
  pending: boolean;
  error: boolean;
  install: () => Promise<void>;
};

const InstallContext = createContext<InstallState | null>(null);

// Listen from the app root: the browser may offer installation before the
// person navigates to the installation page.
export function InstallProvider({ children }: { children: React.ReactNode }) {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const display = window.matchMedia("(display-mode: standalone)");
    const detect = () =>
      setInstalled(
        display.matches ||
          ("standalone" in navigator && navigator.standalone === true),
      );
    const ready = (event: Event) => {
      if (!("prompt" in event) || typeof event.prompt !== "function") return;
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    };
    const complete = () => {
      setInstalled(true);
      setPrompt(null);
    };
    detect();
    display.addEventListener("change", detect);
    window.addEventListener("beforeinstallprompt", ready);
    window.addEventListener("appinstalled", complete);
    return () => {
      display.removeEventListener("change", detect);
      window.removeEventListener("beforeinstallprompt", ready);
      window.removeEventListener("appinstalled", complete);
    };
  }, []);

  async function install() {
    if (!prompt) return;
    setPending(true);
    setError(false);
    try {
      await prompt.prompt();
      setPrompt(null);
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <InstallContext.Provider
      value={{ available: Boolean(prompt), installed, pending, error, install }}
    >
      {children}
    </InstallContext.Provider>
  );
}

export function useInstall() {
  const value = useContext(InstallContext);
  if (!value) throw new Error("useInstall requires InstallProvider.");
  return value;
}
