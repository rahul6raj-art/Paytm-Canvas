import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { detectMcpProduct } from "@/lib/mcp/productBindings";
import { MCP_PRESET_TEMPLATES } from "@/lib/mcp/presets";

describe("detectMcpProduct", () => {
  it("detects figma from tool names", () => {
    assert.equal(
      detectMcpProduct([{ name: "get_design_context" }], "custom"),
      "figma",
    );
  });

  it("detects github from tool names", () => {
    assert.equal(
      detectMcpProduct([{ name: "search_repositories" }], "custom"),
      "github",
    );
  });

  it("respects declared product when not custom", () => {
    assert.equal(
      detectMcpProduct([{ name: "unknown_tool" }], "linear"),
      "linear",
    );
  });
});

describe("MCP_PRESET_TEMPLATES", () => {
  it("includes http and stdio presets", () => {
    const transports = new Set(MCP_PRESET_TEMPLATES.map((p) => p.transport));
    assert.ok(transports.has("http"));
    assert.ok(transports.has("stdio"));
  });
});
