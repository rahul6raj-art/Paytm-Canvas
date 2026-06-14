import {
  CreateBucketCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { buildAssetPublicUrl, readS3Config } from "./assetKeys.js";

let client: S3Client | null = null;

export function getS3Client(): S3Client {
  if (client) return client;
  const cfg = readS3Config();
  client = new S3Client({
    region: cfg.region,
    endpoint: cfg.endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: cfg.accessKey,
      secretAccessKey: cfg.secretKey,
    },
  });
  return client;
}

export function assetPublicUrl(storageKey: string): string {
  const cfg = readS3Config();
  return buildAssetPublicUrl(cfg.publicUrl, cfg.bucket, storageKey);
}

export async function ensureStorageBucket(): Promise<void> {
  const cfg = readS3Config();
  const s3 = getS3Client();
  try {
    await s3.send(new HeadBucketCommand({ Bucket: cfg.bucket }));
    return;
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: cfg.bucket }));
  }
}

export async function presignAssetPut(
  storageKey: string,
  contentType: string,
  expiresInSec = 900,
): Promise<string> {
  const cfg = readS3Config();
  const command = new PutObjectCommand({
    Bucket: cfg.bucket,
    Key: storageKey,
    ContentType: contentType,
  });
  return getSignedUrl(getS3Client(), command, { expiresIn: expiresInSec });
}

export async function putAssetObject(
  storageKey: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  const cfg = readS3Config();
  await getS3Client().send(
    new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: storageKey,
      Body: body,
      ContentType: contentType,
    }),
  );
}

export async function objectExists(storageKey: string): Promise<{ byteSize: number } | null> {
  const cfg = readS3Config();
  try {
    const head = await getS3Client().send(
      new HeadObjectCommand({
        Bucket: cfg.bucket,
        Key: storageKey,
      }),
    );
    return { byteSize: Number(head.ContentLength ?? 0) };
  } catch {
    return null;
  }
}
