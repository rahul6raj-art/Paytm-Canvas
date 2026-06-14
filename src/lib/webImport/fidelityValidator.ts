import type { DesignNode, ImportWebSceneNode, WebImportFidelityReport } from "@/lib/webImport/types";
import { isLayoutContainer } from "@/lib/webImport/layoutAnalyzer";

export function scoreDesignTree(root: DesignNode): Omit<WebImportFidelityReport, "score"> {
  let flexContainers = 0;
  let gridContainers = 0;
  let autoLayoutFrames = 0;
  let textNodes = 0;
  let imageNodes = 0;
  let vectorNodes = 0;
  let componentMasters = 0;
  let componentInstances = 0;
  let absoluteNodes = 0;
  let hugSizingNodes = 0;
  let fillSizingNodes = 0;
  const warnings: string[] = [];

  const walk = (node: DesignNode) => {
    if (node.layout.kind === "flex") flexContainers++;
    if (node.layout.kind === "grid") gridContainers++;
    if (isLayoutContainer(node.layout)) autoLayoutFrames++;
    if (node.layout.layoutPositioning === "absolute") absoluteNodes++;
    if (node.layout.layoutSizingHorizontal === "hug" || node.layout.layoutSizingVertical === "hug") {
      hugSizingNodes++;
    }
    if (node.layout.layoutSizingHorizontal === "fill" || node.layout.layoutSizingVertical === "fill") {
      fillSizingNodes++;
    }
    if (node.role === "text" || (node.text && node.children.length === 0)) textNodes++;
    if (node.role === "image" || node.role === "avatar" || node.imageSrc) imageNodes++;
    if (node.svgMarkup) vectorNodes++;
    if (node.isComponentMaster) componentMasters++;
    if (node.sourceComponentId) componentInstances++;
    node.children.forEach(walk);
  };
  walk(root);

  if (flexContainers === 0 && gridContainers === 0) {
    warnings.push("No flex or grid containers detected — layout may be absolute-heavy.");
  }
  if (componentMasters === 0 && componentInstances === 0) {
    warnings.push("No repeated components detected.");
  }

  const layoutScore = Math.min(100, autoLayoutFrames * 8 + hugSizingNodes * 2 + fillSizingNodes * 2);
  const typographyScore = Math.min(100, textNodes * 5);
  const visualScore = Math.min(100, imageNodes * 4 + vectorNodes * 10);
  const componentScore = Math.min(100, componentMasters * 20 + componentInstances * 5);

  return {
    layoutScore,
    typographyScore,
    visualScore,
    componentScore,
    autoLayoutFrames,
    flexContainers,
    gridContainers,
    textNodes,
    imageNodes,
    vectorNodes,
    componentMasters,
    componentInstances,
    absoluteNodes,
    hugSizingNodes,
    fillSizingNodes,
    warnings,
  };
}

export function scoreSceneTree(scene: ImportWebSceneNode): Omit<WebImportFidelityReport, "score"> {
  let autoLayoutFrames = 0;
  let textNodes = 0;
  let imageNodes = 0;
  let vectorNodes = 0;
  let componentMasters = 0;
  let componentInstances = 0;
  let hugSizingNodes = 0;
  let fillSizingNodes = 0;
  const warnings: string[] = [];

  const walk = (node: ImportWebSceneNode) => {
    if (node.layoutMode && node.layoutMode !== "none") autoLayoutFrames++;
    if (node.type === "text") textNodes++;
    if (node.type === "image") imageNodes++;
    if (node.type === "path") vectorNodes++;
    if (node.isComponent) componentMasters++;
    if (node.sourceComponentId) componentInstances++;
    if (node.layoutSizingHorizontal === "hug" || node.layoutSizingVertical === "hug") hugSizingNodes++;
    if (node.layoutSizingHorizontal === "fill" || node.layoutSizingVertical === "fill") fillSizingNodes++;
    node.children?.forEach(walk);
  };
  walk(scene);

  const layoutScore = Math.min(100, autoLayoutFrames * 8 + hugSizingNodes * 2 + fillSizingNodes * 2);
  const typographyScore = Math.min(100, textNodes * 5);
  const visualScore = Math.min(100, imageNodes * 4 + vectorNodes * 10);
  const componentScore = Math.min(100, componentMasters * 20 + componentInstances * 5);

  return {
    layoutScore,
    typographyScore,
    visualScore,
    componentScore,
    autoLayoutFrames,
    flexContainers: 0,
    gridContainers: 0,
    textNodes,
    imageNodes,
    vectorNodes,
    componentMasters,
    componentInstances,
    absoluteNodes: 0,
    hugSizingNodes,
    fillSizingNodes,
    warnings,
  };
}

export function buildFidelityReport(
  partial: Omit<WebImportFidelityReport, "score">,
): WebImportFidelityReport {
  const score = Math.round(
    partial.layoutScore * 0.4 +
      partial.typographyScore * 0.2 +
      partial.visualScore * 0.25 +
      partial.componentScore * 0.15,
  );
  return { ...partial, score: Math.max(0, Math.min(100, score)) };
}

export function compareFidelity(
  designPartial: Omit<WebImportFidelityReport, "score">,
  scenePartial: Omit<WebImportFidelityReport, "score">,
): WebImportFidelityReport {
  const merged: Omit<WebImportFidelityReport, "score"> = {
    layoutScore: Math.round((designPartial.layoutScore + scenePartial.layoutScore) / 2),
    typographyScore: Math.round((designPartial.typographyScore + scenePartial.typographyScore) / 2),
    visualScore: Math.round((designPartial.visualScore + scenePartial.visualScore) / 2),
    componentScore: Math.round((designPartial.componentScore + scenePartial.componentScore) / 2),
    autoLayoutFrames: scenePartial.autoLayoutFrames,
    flexContainers: designPartial.flexContainers,
    gridContainers: designPartial.gridContainers,
    textNodes: scenePartial.textNodes,
    imageNodes: scenePartial.imageNodes,
    vectorNodes: scenePartial.vectorNodes,
    componentMasters: scenePartial.componentMasters,
    componentInstances: scenePartial.componentInstances,
    absoluteNodes: designPartial.absoluteNodes,
    hugSizingNodes: scenePartial.hugSizingNodes,
    fillSizingNodes: scenePartial.fillSizingNodes,
    warnings: [...designPartial.warnings, ...scenePartial.warnings],
  };
  return buildFidelityReport(merged);
}
