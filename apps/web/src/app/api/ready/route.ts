import { connection } from "next/server";
import { readiness, readinessResponse } from "@/modules/platform/readiness";

export async function GET() {
  await connection();
  return readinessResponse(await readiness());
}
