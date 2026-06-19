import { mkdirSync, readFileSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import path from "node:path";
import { craftBridgeStoreDir } from "./config";
import type { CraftBridgePendingImport } from "./types";

function storePath(name: string): string {
  const dir = path.resolve(process.cwd(), craftBridgeStoreDir());
  mkdirSync(dir, { recursive: true });
  return path.join(dir, name);
}

export function writePendingImport(payload: CraftBridgePendingImport): void {
  writeFileSync(storePath("pending-import.json"), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

export function readPendingImport(): CraftBridgePendingImport | null {
  const file = storePath("pending-import.json");
  if (!existsSync(file)) return null;
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as CraftBridgePendingImport;
    if (!parsed?.slice || typeof parsed.slice !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingImport(): void {
  const file = storePath("pending-import.json");
  if (existsSync(file)) unlinkSync(file);
}
