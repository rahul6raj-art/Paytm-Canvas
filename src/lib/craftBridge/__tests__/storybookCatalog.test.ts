import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  catalogHashForStories,
  groupComponentStoriesFromIndex,
  parseStorybookVariantProperties,
  parseStorybookIndex,
  pickComponentStoriesFromIndex,
  probeStorybookComponentCatalog,
  storybookIframeUrl,
  storybookVariantMasterName,
} from "@/lib/craftBridge/storybookCatalog";
import {
  ensureStorybookLibraryContainer,
  finalizeStorybookComponentGroup,
  mergeStorybookCaptureAsMaster,
} from "@/lib/craftBridge/storybookComponentLibrary";
import type { EditorNode } from "@/stores/useEditorStore";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";

describe("storybookCatalog", () => {
  it("parses Storybook 7 index and groups all stories per component title", () => {
    const entries = parseStorybookIndex({
      entries: {
        "components-listitem--default": {
          id: "components-listitem--default",
          title: "Components/ListItem",
          name: "Default",
          type: "story",
        },
        "components-listitem--hover": {
          id: "components-listitem--hover",
          title: "Components/ListItem",
          name: "Hover",
          type: "story",
        },
        "components-button--primary": {
          id: "components-button--primary",
          title: "Components/Button",
          name: "Primary",
          type: "story",
        },
        "components-button--filled": {
          id: "components-button--filled",
          title: "Components/Button",
          name: "Type / Filled",
          type: "story",
        },
        "docs-readme--page": {
          id: "docs-readme--page",
          title: "Docs/Readme",
          name: "Page",
          type: "docs",
        },
      },
    });

    const groups = groupComponentStoriesFromIndex(entries, "http://localhost:6006");
    assert.equal(groups.length, 2);
    assert.equal(groups.find((g) => g.componentLabel === "Button")?.stories.length, 2);
    assert.equal(groups.find((g) => g.componentLabel === "ListItem")?.stories.length, 2);

    const stories = pickComponentStoriesFromIndex(entries, "http://localhost:6006");
    assert.equal(stories.length, 4);
    assert.deepEqual(
      stories.find((s) => s.name === "Type / Filled")?.variantProperties,
      parseStorybookVariantProperties("Type / Filled"),
    );
    assert.equal(
      storybookIframeUrl("http://localhost:6006", "components-listitem--default"),
      "http://localhost:6006/iframe.html?id=components-listitem--default&viewMode=story&globals=theme%3Alight%2Cplatform%3Amobile",
    );
    assert.equal(
      catalogHashForStories(stories),
      [
        "components-button--filled",
        "components-button--primary",
        "components-listitem--default",
        "components-listitem--hover",
      ].join("|"),
    );
  });

  it("maps slash-separated story names to variant master paths", () => {
    assert.deepEqual(parseStorybookVariantProperties("Type / Filled"), { Type: "Filled" });
    assert.equal(
      storybookVariantMasterName("Components/Button", "Type / Filled"),
      "Components/Button/Type/Filled",
    );
    assert.equal(storybookVariantMasterName("Components/Badge", "Playground"), "Components/Badge/Playground");
  });

  it("probeStorybookComponentCatalog reports unreachable Storybook", async () => {
    const probe = await probeStorybookComponentCatalog("http://127.0.0.1:1");
    assert.equal(probe.ok, false);
    if (!probe.ok) {
      assert.match(probe.error, /not reachable/i);
      assert.match(probe.error, /npm run storybook/i);
    }
  });
});

describe("storybookComponentLibrary", () => {
  it("merges a captured story as a component master under the library frame", () => {
    const nodes: Record<string, EditorNode> = {
      screen: {
        id: "screen",
        parentId: null,
        type: "frame",
        name: "Screen",
        x: 0,
        y: 0,
        width: 390,
        height: 844,
        rotation: 0,
        visible: true,
        locked: false,
      },
    };
    const childOrder = { [EDITOR_ROOT_KEY]: ["screen"] };
    const assets = {};
    const containerId = ensureStorybookLibraryContainer(nodes, childOrder);

    const capture = {
      nodes: {
        root: {
          id: "root",
          parentId: null,
          type: "frame",
          name: "ListItem",
          x: 0,
          y: 0,
          width: 390,
          height: 88,
          rotation: 0,
          visible: true,
          locked: false,
          fill: "#ffffff",
          fillEnabled: true,
        },
      },
      childOrder: { [EDITOR_ROOT_KEY]: ["root"] },
      assets: {},
    };

    const masterId = mergeStorybookCaptureAsMaster(
      nodes,
      childOrder,
      assets,
      containerId,
      capture,
      {
        id: "components-listitem--default",
        title: "Components/ListItem",
        name: "Default",
        componentLabel: "ListItem",
        iframeUrl: "http://localhost:6006/iframe.html?id=components-listitem--default",
        variantProperties: { Variant: "Default" },
      },
    );

    assert.ok(masterId);
    assert.equal(nodes[masterId!]?.isComponent, true);
    assert.equal(nodes[masterId!]?.remoteComponentId, "components-listitem--default");
    assert.equal(nodes[masterId!]?.name, "Components/ListItem/Default");
    assert.ok((childOrder[containerId] ?? []).includes(masterId!));
  });

  it("combines multiple variant masters into a component set", () => {
    const nodes: Record<string, EditorNode> = {};
    const childOrder: Record<string, string[]> = { [EDITOR_ROOT_KEY]: [] };
    const assets = {};
    const containerId = ensureStorybookLibraryContainer(nodes, childOrder);

    const mkCapture = (id: string, y: number) => ({
      nodes: {
        root: {
          id: "root",
          parentId: null,
          type: "frame" as const,
          name: "Button",
          x: 0,
          y: 0,
          width: 120,
          height: 48,
          rotation: 0,
          visible: true,
          locked: false,
          fillEnabled: true,
          fill: "#0000ff",
        },
      },
      childOrder: { [EDITOR_ROOT_KEY]: ["root"] },
      assets: {},
    });

    const a = mergeStorybookCaptureAsMaster(nodes, childOrder, assets, containerId, mkCapture("a", 0), {
      id: "components-button--filled",
      title: "Components/Button",
      name: "Type / Filled",
      componentLabel: "Button",
      iframeUrl: "http://localhost:6006/iframe.html?id=components-button--filled",
      variantProperties: { Type: "Filled" },
    });
    const b = mergeStorybookCaptureAsMaster(nodes, childOrder, assets, containerId, mkCapture("b", 60), {
      id: "components-button--stroke",
      title: "Components/Button",
      name: "Type / Stroke",
      componentLabel: "Button",
      iframeUrl: "http://localhost:6006/iframe.html?id=components-button--stroke",
      variantProperties: { Type: "Stroke" },
    });

    assert.ok(a && b);
    const setId = finalizeStorybookComponentGroup(nodes, childOrder, [a!, b!]);
    assert.ok(setId);
    assert.equal(nodes[setId!]?.isComponentSet, true);
    assert.equal(nodes[a!]?.variantGroupId, nodes[b!]?.variantGroupId);
    assert.equal(nodes[a!]?.parentId, setId);
  });
});
