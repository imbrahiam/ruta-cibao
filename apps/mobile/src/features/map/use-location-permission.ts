import * as Location from "expo-location";
import { useCallback, useEffect, useState } from "react";

/**
 * Whether the app may show the person's position. It never asks on its own:
 * only `request()`, called from an explicit "my location" action, prompts.
 */
export function useLocationPermission() {
  const [granted, setGranted] = useState(false);

  useEffect(() => {
    Location.getForegroundPermissionsAsync().then((status) =>
      setGranted(status.granted),
    );
  }, []);

  const request = useCallback(async () => {
    const status = await Location.requestForegroundPermissionsAsync();
    setGranted(status.granted);
    return status.granted;
  }, []);

  return { granted, request };
}
