import path from "node:path";
import { allowedRepoRoots } from "./config";

export type SafePathResult =
  | { ok: true; absolutePath: string }
  | { ok: false; error: string };

function isUnderAllowedRoot(absTarget: string): boolean {
  const roots = allowedRepoRoots();
  if (roots.length === 0) return true;
  const normalized = path.resolve(absTarget);
  return roots.some((root) => {
    const absRoot = path.resolve(root);
    const rel = path.relative(absRoot, normalized);
    return !rel.startsWith("..") && !path.isAbsolute(rel);
  });
}

/** Resolve sourcePath under repoRoot; reject path traversal and disallowed roots. */
export function resolveSafeSourcePath(repoRoot: string, sourcePath: string): SafePathResult {
  const root = repoRoot.trim();
  const rel = sourcePath.trim().replace(/\\/g, "/");
  if (!root) return { ok: false, error: "repoRoot is required." };
  if (!rel) return { ok: false, error: "sourcePath is required." };
  if (path.isAbsolute(rel)) {
    return { ok: false, error: "sourcePath must be relative to repoRoot." };
  }
  if (rel.startsWith("..") || rel.includes("/../") || rel.includes("\\..\\")) {
    return { ok: false, error: "sourcePath must not traverse outside repoRoot." };
  }

  const absRoot = path.resolve(root);
  const absTarget = path.resolve(absRoot, rel);
  const relCheck = path.relative(absRoot, absTarget);
  if (relCheck.startsWith("..") || path.isAbsolute(relCheck)) {
    return { ok: false, error: "Resolved path escapes repoRoot." };
  }

  if (!isUnderAllowedRoot(absRoot) || !isUnderAllowedRoot(absTarget)) {
    return {
      ok: false,
      error: "repoRoot is not in CRAFT_BRIDGE_ALLOWED_REPO_ROOTS.",
    };
  }

  return { ok: true, absolutePath: absTarget };
}
