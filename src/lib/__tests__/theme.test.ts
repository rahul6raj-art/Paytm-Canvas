import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveTheme } from "@/lib/theme";

describe("theme", () => {
  it("resolves explicit preferences", () => {
    assert.equal(resolveTheme("light"), "light");
    assert.equal(resolveTheme("dark"), "dark");
  });
});
