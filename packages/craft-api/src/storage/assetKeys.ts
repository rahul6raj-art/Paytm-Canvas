export type S3Config = {
  endpoint: string;
  bucket: string;
  publicUrl: string;
  accessKey: string;
  secretKey: string;
  region: string;
};

export function readS3Config(): S3Config {
  return {
    endpoint: process.env.S3_ENDPOINT?.trim() || "http://localhost:9000",
    bucket: process.env.S3_BUCKET?.trim() || "craft-assets",
    publicUrl: process.env.S3_PUBLIC_URL?.trim() || "http://localhost:9000",
    accessKey: process.env.S3_ACCESS_KEY?.trim() || "craft",
    secretKey: process.env.S3_SECRET_KEY?.trim() || "craftcraft",
    region: process.env.S3_REGION?.trim() || "us-east-1",
  };
}

export function newAssetId(): string {
  return `asset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function sanitizeAssetFileName(fileName: string): string {
  const trimmed = fileName.trim() || "upload";
  return trimmed.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
}

export function buildAssetStorageKey(workspaceId: string, assetId: string, fileName: string): string {
  const safe = sanitizeAssetFileName(fileName);
  return `workspaces/${workspaceId}/assets/${assetId}/${safe}`;
}

/** Path-style public URL (MinIO / R2 dev). */
export function buildAssetPublicUrl(publicBase: string, bucket: string, storageKey: string): string {
  const base = publicBase.replace(/\/$/, "");
  const encodedKey = storageKey
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `${base}/${bucket}/${encodedKey}`;
}

export function guessMimeFromFileName(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}
