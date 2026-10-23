import { connection } from "next/server";
import { readiness } from "@/modules/platform/readiness";

export async function GET() {
  await connection();
  const result = await readiness();
  return Response.json(result, {
    status: result.status === "ok" ? 200 : 503,
    headers: { "cache-control": "no-store" },
  });
}
