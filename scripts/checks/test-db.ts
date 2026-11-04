/**
 * Runs every suite, integration ones included, against disposable copies of
 * the local services: `<database>_tests` on the same Postgres and
 * `<bucket>-tests` on the same S3 endpoint. `.env` keeps pointing at
 * development data, which the suites refuse to touch. The database is
 * recreated on every run; the bucket is created on first use. Names that
 * already read as test names (as in CI) are used unchanged.
 *
 * Run: bun run test:db [extra `bun test` arguments]
 */
import path from "node:path";
import {
  CreateBucketCommand,
  HeadBucketCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { SQL } from "bun";

const TEST_NAME = /(?:^|[-_])(test|tests)(?:$|[-_])/i;
const LOOPBACK = ["localhost", "127.0.0.1", "[::1]"];
const root = path.resolve(import.meta.dir, "../..");

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`${name} is required; see .env.example.`);
    process.exit(1);
  }
  return value;
}

function loopbackOnly(url: URL, what: string) {
  if (!LOOPBACK.includes(url.hostname)) {
    console.error(`${what} must be on this machine to run integration tests.`);
    process.exit(1);
  }
}

const database = new URL(required("DATABASE_URL"));
loopbackOnly(database, "DATABASE_URL");
const databaseName = decodeURIComponent(database.pathname.slice(1));
if (!TEST_NAME.test(databaseName)) {
  const testName = `${databaseName}_tests`;
  // Recreated every run: a disposable database never carries one run's rows,
  // or an older migration history, into the next.
  const admin = new SQL(database.toString());
  await admin.unsafe(`drop database if exists "${testName}" with (force)`);
  await admin.unsafe(`create database "${testName}"`);
  await admin.close();
  database.pathname = `/${testName}`;
}

const endpoint = new URL(required("S3_ENDPOINT"));
loopbackOnly(endpoint, "S3_ENDPOINT");
const baseBucket = required("S3_BUCKET");
const bucket = TEST_NAME.test(baseBucket) ? baseBucket : `${baseBucket}-tests`;
const s3 = new S3Client({
  endpoint: endpoint.toString(),
  region: process.env.S3_REGION ?? "us-east-1",
  forcePathStyle: true,
  credentials: {
    accessKeyId: required("S3_ACCESS_KEY_ID"),
    secretAccessKey: required("S3_SECRET_ACCESS_KEY"),
  },
});
try {
  await s3.send(new HeadBucketCommand({ Bucket: bucket }));
} catch {
  await s3.send(new CreateBucketCommand({ Bucket: bucket }));
  console.log(`created bucket ${bucket}`);
}

const env = {
  ...process.env,
  DATABASE_URL: database.toString(),
  S3_BUCKET: bucket,
  S3_FORCE_PATH_STYLE: "1",
  RUN_DB_TESTS: "1",
  RUN_STORAGE_TESTS: "1",
};

function run(command: string[], cwd: string): number {
  return Bun.spawnSync(command, {
    cwd,
    env,
    stdio: ["inherit", "inherit", "inherit"],
  }).exitCode;
}

const migrated = run(
  ["bun", "run", "src/db/migrate.ts"],
  path.join(root, "apps/web"),
);
if (migrated !== 0) process.exit(migrated);
process.exit(
  run(["bun", "test", "apps/web/tests", ...process.argv.slice(2)], root),
);
