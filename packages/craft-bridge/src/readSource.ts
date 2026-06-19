import { readFileSync, statSync, existsSync } from "node:fs";
import { resolveLinkedPageEntryPath } from "./resolvePageSource";
import { resolveSafeSourcePath } from "./pathSafety";
import { hashSourceContent } from "./sourceHash";

export type ReadSourceResult =
  | {
      ok: true;
      content: string;
      hash: string;
      mtime: string;
      absolutePath: string;
    }
  | { ok: false; error: string };

export function readSourceFile(repoRoot: string, sourcePath: string): ReadSourceResult {
  const entryPath = resolveLinkedPageEntryPath(repoRoot, sourcePath);
  const resolved = resolveSafeSourcePath(repoRoot, entryPath);
  if (!resolved.ok) return { ok: false, error: resolved.error };

  if (!existsSync(resolved.absolutePath)) {
    return { ok: false, error: `Source file not found: ${resolved.absolutePath}` };
  }

  const content = readFileSync(resolved.absolutePath, "utf8");
  const st = statSync(resolved.absolutePath);

  return {
    ok: true,
    content,
    hash: hashSourceContent(content),
    mtime: st.mtime.toISOString(),
    absolutePath: resolved.absolutePath,
  };
}
