#!/usr/bin/env node
/**
 * Ensure the MinIO/S3 bucket exists for local asset uploads.
 */
import { copyFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const apiDir = join(root, "packages/craft-api");
const envExample = join(apiDir, ".env.example");
const envFile = join(apiDir, ".env");

if (!existsSync(envFile) && existsSync(envExample)) {
  copyFileSync(envExample, envFile);
}

import { PutBucketCorsCommand } from "@aws-sdk/client-s3";
import { ensureStorageBucket, getS3Client } from "../packages/craft-api/src/storage/s3.ts";
import { readS3Config } from "../packages/craft-api/src/storage/assetKeys.ts";

console.log("[storage:setup] ensuring bucket");
const cfg = readS3Config();
try {
  await ensureStorageBucket();
  const s3 = getS3Client();
  await s3.send(
    new PutBucketCorsCommand({
      Bucket: cfg.bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: ["http://localhost:3000", "http://127.0.0.1:3000"],
            AllowedMethods: ["GET", "PUT", "HEAD"],
            AllowedHeaders: ["*"],
            ExposeHeaders: ["ETag"],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    }),
  );
  console.log(`[storage:setup] ok — bucket "${cfg.bucket}" at ${cfg.endpoint}`);
} catch (e) {
  console.warn("[storage:setup] skipped (is MinIO running? npm run db:up)");
  console.warn(e);
}
