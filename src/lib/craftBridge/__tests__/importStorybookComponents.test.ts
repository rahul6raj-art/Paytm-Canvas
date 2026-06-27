import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import type { EditorNode } from "@/stores/useEditorStore";
import { importedStorybookStoryIds } from "@/lib/craftBridge/storybookComponentLibrary";
import { shouldRefreshStorybookComponents } from "@/lib/craftBridge/projectStorybookComponents";

describe("importStorybookComponents helpers", () => {
  it("tracks imported Storybook story ids from remoteComponentId", () => {
    const nodes: Record<string, EditorNode> = {
      a: {
        id: "a",
        parentId: null,
        type: "frame",
        name: "Button",
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        rotation: 0,
        visible: true,
        locked: false,
        isComponent: true,
        remoteComponentId: "components-button--filled",
      },
    };
    assert.deepEqual([...importedStorybookStoryIds(nodes)], ["components-button--filled"]);
  });

  it("should refresh when catalog hash matches but masters are missing", async () => {
    const nodes: Record<string, EditorNode> = {
      screen: {
        id: "screen",
        parentId: null,
        type: "frame",
        name: "Screen",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        rotation: 0,
        visible: true,
        locked: false,
      },
    };
    const childOrder = { [EDITOR_ROOT_KEY]: ["screen"] };
    const hash =
      "components-button--filled|components-button--stroke|components-listitem--default";

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          entries: {
            "components-button--filled": {
              id: "components-button--filled",
              title: "Components/Button",
              name: "Filled",
              type: "story",
            },
            "components-button--stroke": {
              id: "components-button--stroke",
              title: "Components/Button",
              name: "Stroke",
              type: "story",
            },
            "components-listitem--default": {
              id: "components-listitem--default",
              title: "Components/ListItem",
              name: "Default",
              type: "story",
            },
          },
        }),
        { status: 200 },
      )) as typeof fetch;

    try {
      const needsRefresh = await shouldRefreshStorybookComponents(
        {
          nodes,
          childOrder,
          storybookUrl: "http://localhost:6006",
          storybookCatalogHash: hash,
          codeRoundTripLink: { repoRoot: "/repo", sourcePath: "src/App.tsx", cssPaths: [] },
        },
        { repoRoot: "/repo", sourcePath: "src/App.tsx", cssPaths: [] },
      );
      assert.equal(needsRefresh, true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
