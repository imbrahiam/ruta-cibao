import { z } from "zod";

const collectionSchema = z.object({
  features: z.array(
    z.object({
      properties: z.object({
        id: z.uuid(),
        thumbnailSource: z.enum(["app", "google"]).nullable().optional(),
      }),
    }),
  ),
});

async function main() {
  const origin = new URL(process.argv[2] ?? "http://localhost:3000");
  if (!["http:", "https:"].includes(origin.protocol)) {
    throw new Error("The server origin must use HTTP or HTTPS.");
  }
  const response = await fetch(new URL("/api/places/geojson", origin), {
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error("The published place collection failed.");
  const collection = collectionSchema.parse(await response.json());
  const matched = collection.features.filter(
    ({ properties }) => properties.thumbnailSource === "google",
  );
  const statuses = new Map<number, number>();
  let failed = 0;
  for (const [index, { properties }] of matched.entries()) {
    if (index > 0) await Bun.sleep(1_500);
    try {
      // Do not follow the capability: this warms the running server's resolver,
      // not a second cache inside this short-lived script process.
      const thumbnail = await fetch(
        new URL(`/api/places/${properties.id}/thumbnail`, origin),
        { redirect: "manual", signal: AbortSignal.timeout(20_000) },
      );
      statuses.set(thumbnail.status, (statuses.get(thumbnail.status) ?? 0) + 1);
      await thumbnail.body?.cancel();
    } catch {
      failed++;
    }
  }
  console.log(
    `Google photo warm-up: ${matched.length} matched places, ${statuses.get(302) ?? 0} HTTP 302 redirects, ${failed} network failures.`,
  );
  console.log(
    `HTTP statuses: ${JSON.stringify(Object.fromEntries(statuses.entries()))}`,
  );
  if (failed || [...statuses.keys()].some((status) => status >= 429)) {
    process.exitCode = 1;
  }
}

try {
  await main();
} catch {
  console.error(
    "Google photo warm-up failed. Check the HTTP server and collection response.",
  );
  process.exitCode = 1;
}
