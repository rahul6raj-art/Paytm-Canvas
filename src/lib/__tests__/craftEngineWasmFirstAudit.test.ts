import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const STORE_PATH = join(process.cwd(), "src/stores/useEditorStore.ts");

function storeActionsSource(source: string): string {
  const marker = "export const useEditorStore = create";
  const start = source.indexOf(marker);
  assert.ok(start >= 0, "useEditorStore implementation not found");
  return source.slice(start);
}

function actionBody(source: string, actionName: string): string {
  const actions = storeActionsSource(source);
  const patterns = [`\n  ${actionName}: () => {`, `\n  ${actionName}: (`];
  let start = -1;
  for (const pattern of patterns) {
    start = actions.indexOf(pattern);
    if (start >= 0) break;
  }
  assert.ok(start >= 0, `missing store action implementation ${actionName}`);
  const rest = actions.slice(start + 1);
  const nextAction = rest.search(/\n  [a-zA-Z]+:/);
  const end = nextAction >= 0 ? nextAction + 1 : rest.length;
  return rest.slice(0, end);
}

describe("craftEngineWasmFirstAudit", () => {
  const source = readFileSync(STORE_PATH, "utf8");

  const wasmFirstActions: Array<[string, string]> = [
    ["toggleGrid", "buildToggleGridResult"],
    ["toggleRulers", "buildToggleRulersResult"],
    ["resizeNode", "buildResizeNodeResult"],
    ["resizeFrameWithConstraints", "buildResizeFrameWithConstraintsResult"],
    ["endRotateInteraction", "buildEndRotateInteractionResult"],
    ["updateResponsivePreviewBounds", "buildUpdateResponsivePreviewBoundsResult"],
    ["openResponsivePreview", "buildOpenResponsivePreviewResult"],
    ["cancelResponsivePreview", "buildCancelResponsivePreviewResult"],
    ["updateNode", "buildUpdateNodeResult"],
    ["updateNodes", "buildUpdateNodesResult"],
    ["deleteSelection", "buildDeleteSelectionResult"],
  ];

  for (const [action, builder] of wasmFirstActions) {
    it(`${action} uses WASM-first builder`, () => {
      const body = actionBody(source, action);
      assert.ok(body.includes(builder), `${action} should reference ${builder}`);
      assert.ok(
        body.includes("commitStructuralResult") || body.includes("commitDocumentMutation"),
        `${action} should commit through WASM-first path`,
      );
    });
  }

  it("toggleRulers no longer uses direct set() for page prefs", () => {
    const body = actionBody(source, "toggleRulers");
    assert.equal(body.includes("set((s) =>"), false);
  });
});
