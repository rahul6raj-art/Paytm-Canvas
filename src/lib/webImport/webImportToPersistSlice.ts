import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import { wrapPersistSliceWithPages } from "@/lib/documentPersistence";
import type { EditorAsset, EditorPersistSlice } from "@/lib/documentPersistence";
import type { EditorNode } from "@/stores/useEditorStore";
import type { ImportWebResponse, ImportWebSceneNode } from "@/lib/webImport/types";
import { buildScreenshotReferenceLayer } from "@/lib/webImport/screenshotReferenceLayer";
import { finalizeWebImportGraph } from "@/lib/webImport/finalizeWebImportGraph";
import { clearCanonicalTextLayoutCache } from "@/lib/text/canonicalTextLayout";
import { bumpTextLayoutEpoch } from "@/lib/text/textLayoutEpoch";

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
    fillType: node.fillType,
    fillGradient: node.fillGradient,
    strokeColor: node.strokeColor,
    strokeWidth: node.strokeWidth,
    strokeEnabled: node.strokeEnabled,
    cornerRadius: node.cornerRadius,
    cornerRadii: node.cornerRadii,
    opacity: node.opacity,
    effects: node.effects,
    content: node.content,
    fontFamily: node.fontFamily,
    fontSize: node.fontSize,
    fontWeight: node.fontWeight,
    lineHeight: node.lineHeight,
    letterSpacing: node.letterSpacing,
    textDecoration: node.textDecoration,
    textAlign: node.textAlign,
    verticalAlign: node.verticalAlign,
    textResizeMode: node.textResizeMode,
    textColor: node.fill,
    assetId: node.assetId,
    imageSrc: node.imageSrc,
    imageFitMode: node.imageFitMode,
    pathPoints: node.pathPoints,
    pathClosed: node.pathClosed,
    pathFillRule: node.pathFillRule,
    flattenedPathData: node.flattenedPathData,
    strokeLinecap: node.strokeLinecap,
    strokeLinejoin: node.strokeLinejoin,
    strokeOpacity: node.strokeOpacity,
    layoutMode: node.layoutMode,
    layoutGap: node.layoutGap,
    layoutWrap: node.layoutWrap,
    paddingTop: node.paddingTop,
    paddingRight: node.paddingRight,
    paddingBottom: node.paddingBottom,
    paddingLeft: node.paddingLeft,
    primaryAxisAlign: node.primaryAxisAlign,
    counterAxisAlign: node.counterAxisAlign,
    layoutPositioning: node.layoutPositioning,
    layoutSizingHorizontal: node.layoutSizingHorizontal,
    layoutSizingVertical: node.layoutSizingVertical,
    layoutGrow: node.layoutGrow,
    clipChildren: node.clipChildren,
    isComponent: node.isComponent,
    componentId: node.componentId,
    sourceComponentId: node.sourceComponentId,
    isImportReference: node.isImportReference,
    codeClassName: node.codeClassName,
    codeJsxTag: node.codeJsxTag,
    codeJsxIntrinsic: node.codeJsxIntrinsic,
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

  let frameId: string;

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
    const pageFrame: ImportWebSceneNode = {
      id: "web-page-frame",
      type: "frame",
      name: response.page.title || "Imported page",
      x: 80,
      y: 80,
      width: response.page.width,
      height: response.page.height,
      fillEnabled: false,
      clipChildren: false,
      children: [
        buildScreenshotReferenceLayer(
          response.screenshot,
          response.page.width,
          response.page.height,
          refAssetId,
        ),
      ],
    };
    frameId = sceneNodeToEditor(pageFrame, null, nodes, childOrder);
    childOrder[EDITOR_ROOT_KEY] = [frameId];
  } else {
    const sceneAtOrigin: ImportWebSceneNode = {
      ...response.scene,
      x: 80,
      y: 80,
      clipChildren: response.scene.clipChildren ?? true,
    };
    frameId = sceneNodeToEditor(sceneAtOrigin, null, nodes, childOrder);
    childOrder[EDITOR_ROOT_KEY] = [frameId];

    const finalizedNodes = finalizeWebImportGraph(
      nodes,
      childOrder,
      response.page.width,
      response.page.height,
    );
    for (const [id, n] of Object.entries(finalizedNodes)) {
      nodes[id] = n;
    }
    clearCanonicalTextLayoutCache();
    bumpTextLayoutEpoch();

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
  }

  return wrapPersistSliceWithPages({
    nodes,
    childOrder,
    assets,
    designTokens: {},
    fileName: response.page.title || "Imported from Web",
    selectedIds: [frameId],
    zoom: 0.5,
    pan: { x: 40, y: 24 },
    showGrid: false,
    showRulers: false,
    canvasBackgroundColor: "#e5e5e5",
    comments: [],
  });
}
