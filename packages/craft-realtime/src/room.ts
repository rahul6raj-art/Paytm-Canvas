export function fileIdFromRoom(room: string): string | null {
  const trimmed = room.trim();
  if (!trimmed.startsWith("file:")) return null;
  const fileId = trimmed.slice("file:".length).trim();
  return fileId || null;
}

export function uint8ToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

export function base64ToUint8(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, "base64"));
}
