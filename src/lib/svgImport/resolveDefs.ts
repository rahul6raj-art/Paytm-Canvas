import { parseCssClassRules, type CssSheet } from "@/lib/svgImport/parseStyles";
import { parseFilterBlurEffect } from "@/lib/svgImport/parseFilters";
import { parsePatternElement, type ParsedPattern } from "@/lib/svgImport/parsePatterns";
import type { SvgElement } from "@/lib/svgImport/parseSvg";
import type { SvgImportDiagnostics } from "@/lib/svgImport/svgImportDiagnostics";
import { warnDiag, warnUnsupportedElement } from "@/lib/svgImport/svgImportDiagnostics";
import type { NodeEffect } from "@/lib/nodeEffects";

export type DefsRegistry = {
  gradients: Map<string, never>;
  /** Every element with an id inside <defs> (paths, groups, symbols, …). */
  elements: Map<string, SvgElement>;
  symbols: Map<string, SvgElement>;
  clipPaths: Map<string, SvgElement>;
  masks: Map<string, SvgElement>;
  patterns: Map<string, ParsedPattern>;
  filters: Map<string, { el: SvgElement; blur?: NodeEffect }>;
};

export function createDefsRegistry(): DefsRegistry {
  return {
    gradients: new Map(),
    elements: new Map(),
    symbols: new Map(),
    clipPaths: new Map(),
    masks: new Map(),
    patterns: new Map(),
    filters: new Map(),
  };
}

function registerElement(defs: DefsRegistry, el: SvgElement, diag: SvgImportDiagnostics): void {
  const id = el.getAttr("id");
  const tag = el.tagLower;

  if (id && tag !== "lineargradient" && tag !== "radialgradient") {
    defs.elements.set(id, el);
  }
  if (!id) return;

  if (tag === "lineargradient" || tag === "radialgradient") {
    return;
  }
  if (tag === "symbol") {
    defs.symbols.set(id, el);
  } else if (tag === "clippath") {
    defs.clipPaths.set(id, el);
  } else if (tag === "mask") {
    defs.masks.set(id, el);
  } else if (tag === "pattern") {
    const pattern = parsePatternElement(el, id);
    if (pattern) defs.patterns.set(id, pattern);
  } else if (tag === "filter") {
    const blur = parseFilterBlurEffect(el);
    defs.filters.set(id, { el, blur });
  } else if (
    tag !== "path" &&
    tag !== "g" &&
    tag !== "rect" &&
    tag !== "circle" &&
    tag !== "ellipse" &&
    tag !== "line" &&
    tag !== "polyline" &&
    tag !== "polygon" &&
    tag !== "text" &&
    tag !== "image" &&
    tag !== "use"
  ) {
    warnUnsupportedElement(diag, el.tag, "defs child");
  }
}

function registerDefsSubtree(defs: DefsRegistry, el: SvgElement, diag: SvgImportDiagnostics): void {
  registerElement(defs, el, diag);
  for (const child of el.childElements()) {
    if (child.tagLower === "defs") {
      walkDefs(defs, child, diag);
    } else {
      registerDefsSubtree(defs, child, diag);
    }
  }
}

function walkDefs(defs: DefsRegistry, el: SvgElement, diag: SvgImportDiagnostics): void {
  if (el.tagLower === "defs") {
    for (const child of el.childElements()) {
      registerDefsSubtree(defs, child, diag);
    }
    return;
  }
  for (const child of el.childElements()) {
    walkDefs(defs, child, diag);
  }
}

export function collectDefs(root: SvgElement, diag: SvgImportDiagnostics): DefsRegistry {
  const defs = createDefsRegistry();
  walkDefs(defs, root, diag);
  return defs;
}

export function mergeInheritedGradientHrefs(_defs: DefsRegistry): void {
  /* gradient defs removed */
}

function walkCss(sheet: CssSheet, el: SvgElement): void {
  if (el.tagLower === "style") {
    const text = el.directText().trim();
    if (text) {
      for (const [className, rules] of parseCssClassRules(text)) {
        sheet.set(className, { ...(sheet.get(className) ?? {}), ...rules });
      }
    }
  }
  for (const child of el.childElements()) {
    walkCss(sheet, child);
  }
}

export function collectCssFromSvg(root: SvgElement): CssSheet {
  const sheet: CssSheet = new Map();
  walkCss(sheet, root);
  return sheet;
}
