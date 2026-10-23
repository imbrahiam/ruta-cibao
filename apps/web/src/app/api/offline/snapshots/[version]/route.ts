import { readOfflineSnapshotArtifact } from "@/modules/offline/snapshot";

const NO_STORE_HEADERS = {
  "cache-control": "no-store",
} as const;

export async function GET(
  _request: Request,
  context: { params: Promise<{ version: string }> },
) {
  const { version } = await context.params;
  if (!version || version.length > 120) {
    return Response.json(
      { error: "not_found" },
      { status: 404, headers: NO_STORE_HEADERS },
    );
  }

  const result = await readOfflineSnapshotArtifact(version);
  if (result.status === "not_found") {
    return Response.json(
      { error: "not_found" },
      { status: 404, headers: NO_STORE_HEADERS },
    );
  }
  if (result.status === "revoked") {
    return Response.json(
      { error: "revoked" },
      { status: 410, headers: NO_STORE_HEADERS },
    );
  }

  return new Response(Buffer.from(result.bytes), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      etag: `"${result.sha256}"`,
    },
  });
}
