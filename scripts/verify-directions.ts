import { createApiClient } from "@ruta/contracts/client";

// Calls the running API, not a fixture or a direct provider shortcut.
const client = createApiClient({ origin: "http://localhost:3000" });
try {
  const result = await client.directions.compute({
    origin: { lat: 19.4769, lng: -71.341 },
    destination: { lat: 19.4105, lng: -71.1565 },
    mode: "drive",
  });
  console.log(
    JSON.stringify(
      {
        journey: "Sabaneta to Moncion",
        mode: "drive",
        distanceMeters: result.distanceMeters,
        durationSeconds: result.durationSeconds,
        pathPoints: result.path.length,
        steps: result.steps.length,
      },
      null,
      2,
    ),
  );
} catch (error) {
  // Never print the request, provider body, headers or environment values.
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "REQUEST_FAILED";
  const data =
    error && typeof error === "object" && "data" in error
      ? error.data
      : undefined;
  const reason =
    data && typeof data === "object" && "reason" in data
      ? String(data.reason)
      : undefined;
  console.error(JSON.stringify({ code, reason }));
  process.exitCode = 1;
}
