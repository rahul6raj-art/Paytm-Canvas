import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { resolveSafeSourcePath } from "../pathSafety";
import { readSourceFile } from "../readSource";

describe("craftBridge pathSafety", () => {
  const root = "/Users/dev/my-app";

  it("resolves a normal relative path", () => {
    const r = resolveSafeSourcePath(root, "src/screens/Home.tsx");
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.ok(r.absolutePath.endsWith("src/screens/Home.tsx"));
  });

  it("rejects path traversal", () => {
    const r = resolveSafeSourcePath(root, "../etc/passwd");
    assert.equal(r.ok, false);
  });

  it("rejects absolute sourcePath", () => {
    const r = resolveSafeSourcePath(root, "/tmp/evil.tsx");
    assert.equal(r.ok, false);
  });
});

describe("craftBridge readSource", () => {
  const tmp = path.join(os.tmpdir(), `craft-bridge-read-${Date.now()}`);
  const repo = path.join(tmp, "repo");
  const file = path.join(repo, "src", "Screen.tsx");

  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, "export default function Screen() { return null; }\n", "utf8");

  after(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("reads file content and hash", () => {
    const r = readSourceFile(repo, "src/Screen.tsx");
    if (!r.ok) assert.fail(r.error);
    assert.ok(r.content.includes("Screen"));
    assert.equal(r.hash.length, 64);
  });
});
