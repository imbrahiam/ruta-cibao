"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type GeoFix = {
  lng: number;
  lat: number;
  accuracy: number;
  timestamp: number;
};

export type GeoState =
  | { status: "idle" }
  | { status: "locating" }
  | { status: "tracking"; fix: GeoFix }
  | { status: "denied" }
  | { status: "insecure" }
  | { status: "unavailable" };

/**
 * The device's position, asked for only when the person asks for it.
 *
 * Geolocation is a secure-context API: over plain http on a LAN address the
 * browser refuses without ever showing the permission sheet. That case gets
 * its own state so the interface can say so instead of blaming permissions.
 */
export function useGeolocation() {
  const [state, setState] = useState<GeoState>({ status: "idle" });
  const watch = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
    watch.current = null;
  }, []);

  const start = useCallback(() => {
    if (typeof window === "undefined") return;
    if (!window.isSecureContext) {
      setState({ status: "insecure" });
      return;
    }
    if (!("geolocation" in navigator)) {
      setState({ status: "unavailable" });
      return;
    }
    stop();
    setState((current) =>
      current.status === "tracking" ? current : { status: "locating" },
    );
    watch.current = navigator.geolocation.watchPosition(
      (position) =>
        setState({
          status: "tracking",
          fix: {
            lng: position.coords.longitude,
            lat: position.coords.latitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp,
          },
        }),
      (error) => {
        stop();
        setState({
          status:
            error.code === error.PERMISSION_DENIED ? "denied" : "unavailable",
        });
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
    );
  }, [stop]);

  useEffect(() => stop, [stop]);

  return { state, start, stop };
}
