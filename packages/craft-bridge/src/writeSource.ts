import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { resolveLinkedPageEntryPath } from "./resolvePageSource";
import { resolveSafeSourcePath } from "./pathSafety";
import { hashSourceContent } from "./sourceHash";
import type { CraftBridgeWriteSourceRequest, CraftBridgeWriteSourceResponse } from "./types";

export type WriteSourceResult =
  | CraftBridgeWriteSourceResponse
  | { ok: false; error: string };

export function writeSourceFile(body: CraftBridgeWriteSourceRequest): WriteSourceResult {
  const content = body.content ?? "";
  if (!content.trim()) {
    return { ok: false, error: "content is required." };
  }

  const entryPath = resolveLinkedPageEntryPath(body.repoRoot, body.sourcePath);
  const resolved = resolveSafeSourcePath(body.repoRoot, entryPath);
  if (!resolved.ok) return { ok: false, error: resolved.error };

  const hash = hashSourceContent(content);
  if (body.ifMatchHash && body.ifMatchHash === hash) {
    return {
      ok: true,
      hash,
      writtenAt: new Date().toISOString(),
      absolutePath: resolved.absolutePath,
    };
  }

  mkdirSync(path.dirname(resolved.absolutePath), { recursive: true });
  writeFileSync(resolved.absolutePath, content, "utf8");

  return {
    ok: true,
    hash,
    writtenAt: new Date().toISOString(),
    absolutePath: resolved.absolutePath,
  };
}
