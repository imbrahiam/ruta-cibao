/**
 * Object storage, behind an adapter.
 *
 * Everything goes through the S3 API, so the same code runs against MinIO on a
 * VPS, Cloudflare R2 on Railway, or AWS — which is the portability the project
 * committed to. Nothing here assumes MinIO beyond a config flag.
 *
 * Uploads are presigned rather than proxied through the app: a photo taken on a
 * phone goes straight to storage instead of through a Node process that would
 * hold it in memory the whole way.
 */

import { createHmac } from "node:crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/lib/env";

export async function checkStorage(): Promise<void> {
  await s3().send(new HeadBucketCommand({ Bucket: env.S3_BUCKET }), {
    abortSignal: AbortSignal.timeout(5000),
  });
}

let client: S3Client | undefined;

function s3(): S3Client {
  client ??= new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    // The self-hosted store addresses buckets as a path segment; AWS and R2
    // use a subdomain.
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    // Checksums only where an operation requires one. The SDK's default
    // ("when supported") writes a CRC32 of the *empty* body into every
    // presigned PUT URL, so the photo a browser then sends fails with
    // BadDigest — on any S3 implementation, AWS included.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
  });

  return client;
}

const UPLOAD_URL_TTL_SECONDS = 300;
const READ_URL_TTL_SECONDS = 3600;

/** A URL the browser can PUT one object to, and nothing else. */
export function createUploadUrl(
  key: string,
  contentType: string,
  sizeBytes?: number,
): Promise<string> {
  return getSignedUrl(
    s3(),
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      ContentType: contentType,
      ContentLength: sizeBytes,
    }),
    { expiresIn: UPLOAD_URL_TTL_SECONDS },
  );
}

export function createReadUrl(key: string): Promise<string> {
  return getSignedUrl(
    s3(),
    new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }),
    {
      expiresIn: READ_URL_TTL_SECONDS,
    },
  );
}

/**
 * Puts an object the server produced itself.
 *
 * The presigned path above exists so a phone's photo never travels through this
 * process. A rendered PDF is the opposite case: it was made here, it is already
 * in memory, and handing the worker a URL to PUT to would be a round trip for
 * nothing.
 */
export async function putObject(
  key: string,
  body: Uint8Array,
  contentType: string,
): Promise<void> {
  await s3().send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

/**
 * What storage actually holds at a key, or null if nothing is there.
 *
 * A presigned PUT fixes where a client may write and the declared content
 * type, but not how many bytes or which bytes. So anything that was uploaded
 * straight from a browser is looked at here before the app records it.
 */
export async function statObject(
  key: string,
): Promise<{ size: number; contentType: string | null } | null> {
  try {
    const head = await s3().send(
      new HeadObjectCommand({ Bucket: env.S3_BUCKET, Key: key }),
    );
    return {
      size: head.ContentLength ?? 0,
      contentType: head.ContentType ?? null,
    };
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } })
      .$metadata?.httpStatusCode;
    if (status === 404 || (error as { name?: string }).name === "NotFound") {
      return null;
    }
    throw error;
  }
}

/** A whole object, for the few the server reads back itself. */
export async function getObjectBytes(key: string): Promise<Uint8Array> {
  const response = await s3().send(
    new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }),
  );
  return (await response.Body?.transformToByteArray()) ?? new Uint8Array();
}

/** The first bytes of an object — enough to recognise a file format. */
export async function readObjectHead(
  key: string,
  bytes: number,
): Promise<Uint8Array> {
  const response = await s3().send(
    new GetObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Range: `bytes=0-${bytes - 1}`,
    }),
  );
  return (await response.Body?.transformToByteArray()) ?? new Uint8Array();
}

export async function deleteObject(key: string): Promise<void> {
  await s3().send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
}

/** Every key under a prefix, one page at a time. */
export async function listObjectKeys(prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let token: string | undefined;
  do {
    const page = await s3().send(
      new ListObjectsV2Command({
        Bucket: env.S3_BUCKET,
        Prefix: prefix,
        ContinuationToken: token,
      }),
    );
    for (const object of page.Contents ?? [])
      if (object.Key) keys.push(object.Key);
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

export type ImageTransform = {
  width?: number;
  height?: number;
  /** `fill` crops to the box, `fit` keeps the whole image inside it. */
  resize?: "fill" | "fit";
};

/**
 * A signed imgproxy URL for a stored image.
 *
 * Resizing happens on request, so no thumbnail is ever stored and adding a new
 * size later needs no backfill. The signature is what stops a stranger from
 * pointing the resizer at arbitrary URLs and using it as an open proxy.
 *
 * Falls back to a plain signed read URL when imgproxy is not configured, so
 * development and a bare deployment both still show pictures.
 */
export async function imageUrl(
  key: string,
  transform: ImageTransform = {},
): Promise<string> {
  // Seeded imagery ships in `public/` and is addressed by path, not by object
  // key: there is nothing in the bucket to sign, and the browser can fetch it
  // as it stands. Same convention as `places.imageUrl`.
  if (key.startsWith("/")) return key;

  if (!env.IMGPROXY_URL || !env.IMGPROXY_KEY || !env.IMGPROXY_SALT) {
    return createReadUrl(key);
  }

  const width = transform.width ?? 0;
  const height = transform.height ?? 0;
  const resize = transform.resize ?? "fill";

  const source = Buffer.from(`s3://${env.S3_BUCKET}/${key}`).toString(
    "base64url",
  );
  const path = `/rs:${resize}:${width}:${height}/g:sm/${source}`;

  const signature = createHmac("sha256", Buffer.from(env.IMGPROXY_KEY, "hex"))
    .update(Buffer.from(env.IMGPROXY_SALT, "hex"))
    .update(path)
    .digest("base64url");

  return `${env.IMGPROXY_URL}/${signature}${path}`;
}
