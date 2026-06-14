import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { CRAFT_ENGINE_VERSION, readEngineVersionFromLibRs } from "@/engine/craftEngineVersion";

const root = process.cwd();

describe("craftEngineVersionSync", () => {
  it("TS engine version matches lib.rs", () => {
    const libRs = readFileSync(join(root, "packages/craft-engine/src/lib.rs"), "utf8");
    assert.equal(readEngineVersionFromLibRs(libRs), CRAFT_ENGINE_VERSION);
  });

  it("migration doc status matches engine major.minor", () => {
    const version = CRAFT_ENGINE_VERSION;
    const [major, minor] = version.split(".");
    const doc = readFileSync(join(root, "docs/native-renderer-migration.md"), "utf8");
    assert.ok(
      doc.includes(`migration complete (v${major}.${minor}`),
      `docs/native-renderer-migration.md should reference v${major}.${minor}`,
    );
  });

  it("migration doc engine_version table matches lib.rs", () => {
    const version = CRAFT_ENGINE_VERSION;
    const doc = readFileSync(join(root, "docs/native-renderer-migration.md"), "utf8");
    assert.ok(
      doc.includes(`\`engine_version()\` | \`${version}\``),
      `docs WASM API table should list engine_version ${version}`,
    );
  });
});
