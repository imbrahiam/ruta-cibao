import { expect } from "bun:test";
import { inArray } from "drizzle-orm";
import { db, pool } from "../src/db";
import { roads } from "../src/db/schema";
import { env } from "../src/lib/env";
import { streetAt } from "../src/lib/map/roads";

if (!["localhost", "127.0.0.1"].includes(new URL(env.DATABASE_URL).hostname))
  throw new Error("Road verification requires a local database");
const runId = crypto.randomUUID();
const ids = [`verification-near-${runId}`, `verification-picked-${runId}`];
const anchor = { lng: -71.77701, lat: 19.3 };
try {
  await db.insert(roads).values([
    {
      id: ids[0] ?? "",
      name: "Verification near road",
      kind: "residential",
      path: [
        { x: -71.777, y: 19.299 },
        { x: -71.777, y: 19.301 },
      ],
    },
    {
      id: ids[1] ?? "",
      name: "Verification picked road",
      kind: "residential",
      path: [
        { x: -71.7771, y: 19.299 },
        { x: -71.7771, y: 19.301 },
      ],
    },
  ]);
  const automatic = await streetAt(anchor);
  expect(automatic.street?.name).toBe("Verification near road");
  const explicit = await streetAt({ ...anchor, ...{ roadId: ids[1] } });
  console.log(
    "Nearest road:",
    automatic.street?.name,
    "Explicitly picked road:",
    explicit.street?.name,
  );
  expect(explicit.street?.name).toBe("Verification picked road");
  const distant = await streetAt({
    ...anchor,
    lat: 19.4,
    ...{ roadId: ids[1] },
  });
  expect(distant.street).toBeNull();
  console.log(
    "PASS: an explicit parallel-road choice survives lookup; a distant forged choice is refused",
  );
} finally {
  await db.delete(roads).where(inArray(roads.id, ids));
  await pool.end();
  console.log("Removed road-verification fixtures");
}
