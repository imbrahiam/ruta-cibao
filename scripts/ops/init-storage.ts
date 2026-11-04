/** Initialize the private local bucket and browser upload CORS, idempotently. */
import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketCorsCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { z } from "zod";

const config = z
  .object({
    AWS_ACCESS_KEY_ID: z.string().min(1),
    AWS_SECRET_ACCESS_KEY: z.string().min(1),
    AWS_DEFAULT_REGION: z.string().default("us-east-1"),
    AWS_ENDPOINT_URL: z.url(),
    S3_BUCKET: z.string().min(1),
    CORS_ORIGIN: z.string().min(1),
  })
  .parse(process.env);
const client = new S3Client({
  endpoint: config.AWS_ENDPOINT_URL,
  region: config.AWS_DEFAULT_REGION,
  forcePathStyle: true,
  requestChecksumCalculation: "WHEN_REQUIRED",
  credentials: {
    accessKeyId: config.AWS_ACCESS_KEY_ID,
    secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
  },
});
try {
  try {
    await client.send(new HeadBucketCommand({ Bucket: config.S3_BUCKET }));
  } catch (error) {
    if (
      (error as { $metadata?: { httpStatusCode?: number } }).$metadata
        ?.httpStatusCode !== 404
    )
      throw error;
    await client.send(new CreateBucketCommand({ Bucket: config.S3_BUCKET }));
  }
  await client.send(
    new PutBucketCorsCommand({
      Bucket: config.S3_BUCKET,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: [config.CORS_ORIGIN],
            AllowedMethods: ["PUT", "GET"],
            AllowedHeaders: ["*"],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    }),
  );
  console.info("private bucket and upload CORS ready");
} finally {
  client.destroy();
}
