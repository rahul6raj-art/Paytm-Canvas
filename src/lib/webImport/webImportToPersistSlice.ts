import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import { wrapPersistSliceWithPages } from "@/lib/documentPersistence";
import type { EditorAsset, EditorPersistSlice } from "@/lib/documentPersistence";
import type { EditorNode } from "@/stores/useEditorStore";
import type { ImportWebResponse, ImportWebSceneNode } from "@/lib/webImport/types";
import { buildScreenshotReferenceLayer } from "@/lib/webImport/screenshotReferenceLayer";

function sceneNodeToEditor(
  node: ImportWebSceneNode,
  parentId: string | null,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): string {
  const id = node.id;
  const editorNode: EditorNode = {
    id,
    parentId,
    type: node.type === "ellipse" ? "rectangle" : node.type,
    name: node.name,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    rotation: node.rotation ?? 0,
    visible: node.visible !== false,
    locked: node.locked === true,
    expanded: node.expanded !== false,
    fill: node.fill,
    fillEnabled: node.fillEnabled,
    fillOpacity: node.fillOpacity,
    strokeColor: node.strokeColor,
    strokeWidth: node.strokeWidth,
    cornerRadius: node.cornerRadius,
    opacity: node.opacity,
    content: node.content,
    fontFamily: node.fontFamily,
    fontSize: node.fontSize,
    fontWeight: node.fontWeight,
    textAlign: node.textAlign,
    textColor: node.fill,
    assetId: node.assetId,
    imageSrc: node.imageSrc,
    layoutMode: node.layoutMode,
    layoutGap: node.layoutGap,
    paddingTop: node.paddingTop,
    paddingRight: node.paddingRight,
    paddingBottom: node.paddingBottom,
    paddingLeft: node.paddingLeft,
    primaryAxisAlign: node.primaryAxisAlign,
    counterAxisAlign: node.counterAxisAlign,
    clipChildren: node.clipChildren,
    isImportReference: node.isImportReference,
  };

  nodes[id] = editorNode;
  const childIds: string[] = [];
  for (const child of node.children ?? []) {
    childIds.push(sceneNodeToEditor(child, id, nodes, childOrder));
  }
  childOrder[id] = childIds;
  return id;
}

export function importWebResponseToPersistSlice(response: ImportWebResponse): EditorPersistSlice {
  const nodes: Record<string, EditorNode> = {};
  const childOrder: Record<string, string[]> = { [EDITOR_ROOT_KEY]: [] };
  const assets: Record<string, EditorAsset> = {};
  for (const [id, a] of Object.entries(response.assets)) {
    assets[id] = {
      id,
      name: a.name,
      mimeType: a.mimeType,
      dataUrl: a.dataUrl,
      createdAt: new Date().toISOString(),
    };
  }

  const rootChildren: ImportWebSceneNode[] = [];

  if (response.mode === "screenshot") {
    if (!response.screenshot) {
      throw new Error("Screenshot mode requires a captured screenshot.");
    }
    const refAssetId = "asset-screenshot-ref";
    assets[refAssetId] = {
      id: refAssetId,
      name: "Screenshot reference",
      mimeType: "image/png",
      dataUrl: response.screenshot.dataUrl,
      createdAt: new Date().toISOString(),
      width: response.screenshot.width,
      height: response.screenshot.height,
    };
    rootChildren.push(
      buildScreenshotReferenceLayer(
        response.screenshot,
        response.page.width,
        response.page.height,
        refAssetId,
      ),
    );
  } else {
    rootChildren.push(response.scene);
  }

  const pageFrame: ImportWebSceneNode = {
    id: "web-page-frame",
    type: "frame",
    name: response.page.title || "Imported page",
    x: 80,
    y: 80,
    width: response.page.width,
    height: response.page.height,
    fillEnabled: false,
    clipChildren: true,
    layoutMode: "none",
    children: rootChildren,
  };

  const frameId = sceneNodeToEditor(pageFrame, null, nodes, childOrder);
  childOrder[EDITOR_ROOT_KEY] = [frameId];

  if (response.screenshot && response.mode === "editable_with_reference") {
    const refAssetId = "asset-screenshot-ref";
    if (!assets[refAssetId]) {
      assets[refAssetId] = {
        id: refAssetId,
        name: "Screenshot reference",
        mimeType: "image/png",
        dataUrl: response.screenshot.dataUrl,
        createdAt: new Date().toISOString(),
        width: response.screenshot.width,
        height: response.screenshot.height,
      };
    }
    const ref = buildScreenshotReferenceLayer(
      response.screenshot,
      response.page.width,
      response.page.height,
      refAssetId,
    );
    const refId = sceneNodeToEditor(ref, frameId, nodes, childOrder);
    const frameKids = childOrder[frameId] ?? [];
    childOrder[frameId] = [refId, ...frameKids.filter((id) => id !== refId)];
  }

  const base = wrapPersistSliceWithPages({
    nodes,
    childOrder,
    assets,
    designTokens: {},
    fileName: response.page.title || "Imported from Web",
    selectedIds: [frameId],
    zoom: 0.5,
    pan: { x: 40, y: 24 },
    showGrid: false,
    canvasBackgroundColor: "#e5e5e5",
    comments: [],
  });

  return base;
}
