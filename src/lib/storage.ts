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
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/lib/env";

let client: S3Client | undefined;

function s3(): S3Client {
  client ??= new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    // MinIO addresses buckets as a path segment; AWS and R2 use a subdomain.
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
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
): Promise<string> {
  return getSignedUrl(
    s3(),
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      ContentType: contentType,
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

export async function deleteObject(key: string): Promise<void> {
  await s3().send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
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
