import {
  type OfflineManifest,
  type OfflineSnapshot,
  offlineManifestOutput,
  offlineSnapshotSchema,
} from "@ruta/contracts";
import { sha256Hex } from "./sha256";

export type DownloadStage =
  | "fetching_manifest"
  | "downloading"
  | "validating"
  | "indexing";

export type DownloadProgress = {
  stage: DownloadStage;
  /** Overall 0..1 progress across manifest, download, validation and SQLite indexing. */
  fraction: number;
  loadedBytes?: number;
  totalBytes?: number;
};

export type OfflineValidationErrorCode =
  | "invalid_manifest"
  | "origin_mismatch"
  | "size_mismatch"
  | "checksum_mismatch"
  | "invalid_json"
  | "schema_invalid"
  | "version_mismatch"
  | "revoked"
  | "network";

export class OfflineValidationError extends Error {
  constructor(
    readonly code: OfflineValidationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "OfflineValidationError";
  }
}

/**
 * Validates raw snapshot bytes against the signed manifest (origin, byte size,
 * SHA-256 digest, JSON syntax, Zod schema v1, and version match) before any
 * local SQLite swap is attempted.
 */
export function validateOfflineSnapshotBytes(
  bytes: Uint8Array,
  rawManifest: unknown,
  expectedOrigin?: string,
): { manifest: OfflineManifest; snapshot: OfflineSnapshot } {
  const manifestResult = offlineManifestOutput.safeParse(rawManifest);
  if (!manifestResult.success) {
    throw new OfflineValidationError(
      "invalid_manifest",
      "Offline manifest failed schema validation.",
    );
  }
  const manifest = manifestResult.data;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(manifest.snapshotUrl);
  } catch {
    throw new OfflineValidationError(
      "origin_mismatch",
      "Offline snapshot URL is invalid.",
    );
  }

  const expectedPathPrefix = "/api/offline/snapshots/";
  if (!parsedUrl.pathname.startsWith(expectedPathPrefix)) {
    throw new OfflineValidationError(
      "origin_mismatch",
      `Unexpected offline snapshot path: ${parsedUrl.pathname}`,
    );
  }

  if (expectedOrigin) {
    const expected = new URL(expectedOrigin);
    if (parsedUrl.origin !== expected.origin) {
      throw new OfflineValidationError(
        "origin_mismatch",
        `Snapshot URL origin ${parsedUrl.origin} does not match expected origin ${expected.origin}.`,
      );
    }
  }

  if (bytes.byteLength !== manifest.snapshotBytes) {
    throw new OfflineValidationError(
      "size_mismatch",
      `Snapshot byte length ${bytes.byteLength} does not match manifest size ${manifest.snapshotBytes}.`,
    );
  }

  const actualSha256 = sha256Hex(bytes);
  if (actualSha256 !== manifest.snapshotSha256.toLowerCase()) {
    throw new OfflineValidationError(
      "checksum_mismatch",
      `Snapshot SHA-256 ${actualSha256} does not match manifest ${manifest.snapshotSha256}.`,
    );
  }

  let decoded: unknown;
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    decoded = JSON.parse(text);
  } catch {
    throw new OfflineValidationError(
      "invalid_json",
      "Offline snapshot payload is not valid UTF-8 JSON.",
    );
  }

  const snapshotResult = offlineSnapshotSchema.safeParse(decoded);
  if (!snapshotResult.success) {
    throw new OfflineValidationError(
      "schema_invalid",
      `Offline snapshot failed schema v1 validation: ${snapshotResult.error.issues[0]?.message ?? "invalid shape"}`,
    );
  }
  const snapshot = snapshotResult.data;

  if (snapshot.version !== manifest.version) {
    throw new OfflineValidationError(
      "version_mismatch",
      `Snapshot version ${snapshot.version} does not match manifest version ${manifest.version}.`,
    );
  }

  return { manifest, snapshot };
}

/**
 * Fetches the current manifest and snapshot bytes from the API origin,
 * streaming progress and running full checksum + schema validation.
 */
export async function fetchAndValidateOfflineSnapshot(options: {
  origin: string;
  manifest?: OfflineManifest;
  fetchImpl?: typeof globalThis.fetch;
  onProgress?: (progress: DownloadProgress) => void;
}): Promise<{
  manifest: OfflineManifest;
  snapshot: OfflineSnapshot;
  bytes: Uint8Array;
}> {
  const fetchFn = options.fetchImpl ?? globalThis.fetch;
  const cleanOrigin = options.origin.replace(/\/+$/, "");

  options.onProgress?.({ stage: "fetching_manifest", fraction: 0.02 });

  let manifest = options.manifest;
  if (!manifest) {
    let manifestResponse: Response;
    try {
      manifestResponse = await fetchFn(
        `${cleanOrigin}/api/rpc/offline/manifest`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "cache-control": "no-store",
          },
          body: JSON.stringify({ json: null }),
        },
      );
    } catch {
      throw new OfflineValidationError(
        "network",
        "Could not reach server to fetch offline manifest.",
      );
    }

    if (!manifestResponse.ok) {
      throw new OfflineValidationError(
        manifestResponse.status === 410 ? "revoked" : "network",
        `Manifest request failed with status ${manifestResponse.status}.`,
      );
    }

    const body = (await manifestResponse.json()) as unknown;
    const rawManifest =
      body && typeof body === "object" && "json" in body ? body.json : body;
    const parsed = offlineManifestOutput.safeParse(rawManifest);
    if (!parsed.success) {
      throw new OfflineValidationError(
        "invalid_manifest",
        "Server returned an invalid offline manifest.",
      );
    }
    manifest = parsed.data;
  }

  const totalBytes = manifest.snapshotBytes;
  options.onProgress?.({
    stage: "downloading",
    fraction: 0.08,
    loadedBytes: 0,
    totalBytes,
  });

  // Validate the manifest URL path before requesting bytes.
  let manifestUrl: URL;
  try {
    manifestUrl = new URL(manifest.snapshotUrl);
  } catch {
    throw new OfflineValidationError(
      "origin_mismatch",
      "Invalid snapshotUrl in manifest.",
    );
  }
  if (!manifestUrl.pathname.startsWith("/api/offline/snapshots/")) {
    throw new OfflineValidationError(
      "origin_mismatch",
      "Invalid snapshotUrl path in manifest.",
    );
  }

  let snapshotResponse: Response;
  try {
    snapshotResponse = await fetchFn(manifest.snapshotUrl, {
      method: "GET",
      headers: { "cache-control": "no-store" },
    });
  } catch {
    throw new OfflineValidationError(
      "network",
      "Could not download offline snapshot bytes.",
    );
  }

  if (snapshotResponse.status === 410) {
    throw new OfflineValidationError(
      "revoked",
      "Offline snapshot version was revoked.",
    );
  }
  if (!snapshotResponse.ok) {
    throw new OfflineValidationError(
      "network",
      `Snapshot download failed with HTTP ${snapshotResponse.status}.`,
    );
  }

  let bytes: Uint8Array;
  const reader = snapshotResponse.body?.getReader?.();
  if (reader) {
    const chunks: Uint8Array[] = [];
    let loaded = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        loaded += value.byteLength;
        const downloadRatio =
          totalBytes > 0 ? Math.min(1, loaded / totalBytes) : 0.5;
        options.onProgress?.({
          stage: "downloading",
          fraction: 0.08 + downloadRatio * 0.62,
          loadedBytes: loaded,
          totalBytes,
        });
      }
    }
    bytes = new Uint8Array(loaded);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
  } else {
    const buffer = await snapshotResponse.arrayBuffer();
    bytes = new Uint8Array(buffer);
    options.onProgress?.({
      stage: "downloading",
      fraction: 0.7,
      loadedBytes: bytes.byteLength,
      totalBytes,
    });
  }

  options.onProgress?.({
    stage: "validating",
    fraction: 0.74,
    loadedBytes: bytes.byteLength,
    totalBytes,
  });

  const validated = validateOfflineSnapshotBytes(bytes, manifest, cleanOrigin);
  return {
    manifest: validated.manifest,
    snapshot: validated.snapshot,
    bytes,
  };
}
