export type V1Envelope<T> = { data: T } | { error: { code: string; message: string } };

export type V1ErrorBody = { code: string; message: string };

export function isV1ErrorEnvelope(json: unknown): json is { error: V1ErrorBody } {
  if (!json || typeof json !== "object") return false;
  const row = json as { error?: unknown };
  if (!row.error || typeof row.error !== "object") return false;
  const err = row.error as { code?: unknown; message?: unknown };
  return typeof err.code === "string" && typeof err.message === "string";
}

export function parseV1Data<T>(json: unknown): T {
  if (!json || typeof json !== "object") {
    throw new Error("invalid JSON envelope");
  }
  const envelope = json as V1Envelope<T>;
  if ("error" in envelope && envelope.error) {
    throw new Error(`${envelope.error.code}: ${envelope.error.message}`);
  }
  if (!("data" in envelope)) {
    throw new Error("missing data field in v1 envelope");
  }
  return envelope.data;
}

export function parseV1Error(json: unknown): V1ErrorBody {
  if (!isV1ErrorEnvelope(json)) {
    throw new Error("invalid v1 error envelope");
  }
  return json.error;
}
