import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { EditorNode } from "@/stores/useEditorStore";
import {
  patchBridgeCanvasPayloadIntoSource,
  sourceHasCraftPayload,
  stripPayloadCommentBlock,
} from "../patchBridgeCanvasPayload";
import { looksLikeLinkedAppScreenSource, shouldUseSemanticBridgeSync, isCorruptedCraftDivExport } from "../semanticBridgeSync";
import { parseCodeRoundTripPayload } from "@/lib/codeRoundTrip/reactImport";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";

const SOURCE = `import { Header } from "@/components/Header";
import { Card } from "@/components/Card";

export const PMLMorePage = () => (
  <div className="pml-more">
    <Header title="More" />
    <Card className="pml-more-theme-card" />
  </div>
);
`;

function frame(id: string, extra: Partial<EditorNode> = {}): EditorNode {
  return {
    id,
    parentId: null,
    type: "frame",
    name: "More",
    x: 80,
    y: 80,
    width: 376,
    height: 844,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    bridgeSourcePath: "src/screens/PMLMorePage/PMLMorePage.tsx",
    manualScreenLayout: true,
    ...extra,
  };
}

function rect(id: string, parentId: string): EditorNode {
  return {
    id,
    parentId,
    type: "rectangle",
    name: "Rectangle",
    x: 24,
    y: 320,
    width: 120,
    height: 48,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fill: "#f87171",
    cornerRadius: 8,
    fillEnabled: true,
    fillOpacity: 1,
    strokePosition: "center",
  };
}

describe("patchBridgeCanvasPayload", () => {
  it("embeds the full edited screen subtree in @paytm-craft-payload", () => {
    const nodes: Record<string, EditorNode> = {
      "web-root-1": frame("web-root-1"),
      "rect-1": rect("rect-1", "web-root-1"),
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["web-root-1"],
      "web-root-1": ["rect-1"],
      "rect-1": [],
    };

    const out = patchBridgeCanvasPayloadIntoSource({
      sourceContent: SOURCE,
      sourcePath: "src/screens/PMLMorePage/PMLMorePage.tsx",
      nodes,
      childOrder,
      designTokens: {},
      assets: {},
      link: {
        repoRoot: "/repo",
        sourcePath: "src/screens/PMLMorePage/PMLMorePage.tsx",
        previewUrl: "http://localhost:5173",
      },
      fileName: "PMLMorePage",
    });

    assert.equal(sourceHasCraftPayload(out), true);
    const payload = parseCodeRoundTripPayload(out);
    assert.ok(payload);
    assert.ok(payload!.nodes["rect-1"]);
    assert.ok(payload!.nodes["web-root-1"]);
    assert.match(out, /export const PMLMorePage/);
  });

  it("replaces an existing payload block on subsequent exports", () => {
    const nodes: Record<string, EditorNode> = {
      "web-root-1": frame("web-root-1"),
      "rect-1": rect("rect-1", "web-root-1"),
      "rect-2": rect("rect-2", "web-root-1"),
    };
    nodes["rect-2"] = { ...nodes["rect-2"]!, y: 400 };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["web-root-1"],
      "web-root-1": ["rect-1", "rect-2"],
      "rect-1": [],
      "rect-2": [],
    };

    const first = patchBridgeCanvasPayloadIntoSource({
      sourceContent: SOURCE,
      sourcePath: "src/screens/PMLMorePage/PMLMorePage.tsx",
      nodes: { "web-root-1": nodes["web-root-1"]!, "rect-1": nodes["rect-1"]! },
      childOrder: {
        [EDITOR_ROOT_KEY]: ["web-root-1"],
        "web-root-1": ["rect-1"],
        "rect-1": [],
      },
      designTokens: {},
      assets: {},
      link: {
        repoRoot: "/repo",
        sourcePath: "src/screens/PMLMorePage/PMLMorePage.tsx",
        previewUrl: "http://localhost:5173",
      },
    });

    const second = patchBridgeCanvasPayloadIntoSource({
      sourceContent: first,
      sourcePath: "src/screens/PMLMorePage/PMLMorePage.tsx",
      nodes,
      childOrder,
      designTokens: {},
      assets: {},
      link: {
        repoRoot: "/repo",
        sourcePath: "src/screens/PMLMorePage/PMLMorePage.tsx",
        previewUrl: "http://localhost:5173",
      },
    });

    assert.equal((second.match(/@paytm-craft-payload-start/g) ?? []).length, 1);
    const payload = parseCodeRoundTripPayload(second);
    assert.ok(payload?.nodes["rect-2"]);
  });

  it("stripPayloadCommentBlock removes only the payload comment", () => {
    const withPayload = patchBridgeCanvasPayloadIntoSource({
      sourceContent: SOURCE,
      sourcePath: "src/screens/PMLMorePage/PMLMorePage.tsx",
      nodes: { "web-root-1": frame("web-root-1") },
      childOrder: { [EDITOR_ROOT_KEY]: ["web-root-1"], "web-root-1": [] },
      designTokens: {},
      assets: {},
      link: {
        repoRoot: "/repo",
        sourcePath: "src/screens/PMLMorePage/PMLMorePage.tsx",
        previewUrl: "http://localhost:5173",
      },
    });
    const stripped = stripPayloadCommentBlock(withPayload);
    assert.doesNotMatch(stripped, /@paytm-craft-payload-start/);
    assert.match(stripped, /export const PMLMorePage/);
  });
});

describe("semanticBridgeSync", () => {
  it("keeps semantic patching for linked app screens even after payload is embedded", () => {
    const link = {
      repoRoot: "/repo",
      sourcePath: "src/screens/PMLMorePage/PMLMorePage.tsx",
      previewUrl: "http://localhost:5173",
    };
    assert.equal(looksLikeLinkedAppScreenSource(SOURCE), true);
    const withPayload = patchBridgeCanvasPayloadIntoSource({
      sourceContent: SOURCE,
      sourcePath: link.sourcePath,
      nodes: { "web-root-1": frame("web-root-1") },
      childOrder: { [EDITOR_ROOT_KEY]: ["web-root-1"], "web-root-1": [] },
      designTokens: {},
      assets: {},
      link,
    });
    assert.equal(shouldUseSemanticBridgeSync(link, withPayload), true);
  });

  it("keeps semantic patching for src/screens paths even when the file was corrupted by div export", () => {
    const link = {
      repoRoot: "/repo",
      sourcePath: "src/screens/PMLMorePage/PMLMorePage.tsx",
      previewUrl: "http://localhost:5173",
    };
    const corrupted = `
export function PMLMorePage() {
  return (
    <div style={{ position: "relative", width: "100%", minHeight: "100%" }}>
      <div data-pc-type="frame" className="pml-more" style={{ border: "1px solid #e5e5e5" }} />
    </div>
  );
}
`;
    assert.equal(shouldUseSemanticBridgeSync(link, corrupted), true);
  });

  it("detects corrupted div export missing real components", () => {
    const corrupted = `
export function PMLMorePage() {
  return (
    <div data-pc-type="frame" className="pml-more" style={{ border: "1px solid #e5e5e5" }} />
  );
}
`;
    assert.equal(isCorruptedCraftDivExport(corrupted), true);
    assert.equal(looksLikeLinkedAppScreenSource(corrupted), true);
  });
});
