import { parse } from "@babel/parser";
import type {
  ArrowFunctionExpression,
  CallExpression,
  Expression,
  File,
  FunctionDeclaration,
  FunctionExpression,
  JSXAttribute,
  JSXElement,
  JSXFragment,
  JSXIdentifier,
  JSXMemberExpression,
  JSXNamespacedName,
  JSXSpreadAttribute,
  ObjectExpression,
  SpreadElement,
} from "@babel/types";
import type { LayoutMode } from "@/lib/autoLayout";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import type { EditorPersistSlice } from "@/lib/documentPersistence";
import { wrapPersistSliceWithPages } from "@/lib/documentPersistence";
import { DEFAULT_CANVAS_BACKGROUND } from "@/lib/canvasVisual";
import { DEFAULT_FRAME_FILL, DEFAULT_SHAPE_FILL } from "@/lib/shapes/shapeModel";
import type { EditorNode, NodeKind } from "@/stores/useEditorStore";
import { sanitizeComponentName } from "./reactStyle";
import type { ReactStyleRecord } from "./reactStyle";
import { placeScreenFrameOnCanvas } from "@/lib/codeExport/frameRelativeExport";
import { finalizeImportedGraph } from "./finalizeImportedGraph";
import { canvasScreenLabelFromSource } from "@/lib/craftBridge/canvasScreenLabels";
import { placeholderSizeForComponent } from "./reactComponentPlaceholders";
import { parseNodeKindFromPcAttrs } from "@/lib/codeExport/pcMetadata";
import { classNameToNodePatch, mergeStylePatches } from "./reactClassNameImport";
import {
  collectModuleArrays,
  collectModuleNestedMaps,
  expandMapExpression,
  isStateEqualityGuard,
  resolveClassNameFromExpression,
  type ModuleNestedMaps,
} from "./reactJsxImportExpand";
import { reactStyleToNodePatch } from "./reactStyleImport";
import type { CodeRoundTripPayloadV1 } from "./types";
import { formatCodeRoundTripPayloadBlock } from "./types";

const INTRINSIC_TAGS = new Set([
  "div",
  "span",
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "label",
  "a",
  "button",
  "section",
  "main",
  "article",
  "header",
  "footer",
  "nav",
  "form",
  "ul",
  "ol",
  "li",
  "img",
  "input",
  "textarea",
]);

let idSeq = 0;
function nextId(): string {
  idSeq += 1;
  return `pc-${idSeq}`;
}

export type JsxImportResult =
  | { ok: true; slice: EditorPersistSlice; payload: CodeRoundTripPayloadV1; message: string }
  | { ok: false; error: string };

function getJsxTagName(
  name: JSXIdentifier | JSXMemberExpression | JSXNamespacedName,
): string {
  if (name.type === "JSXIdentifier") return name.name;
  if (name.type === "JSXMemberExpression") {
    const obj =
      name.object.type === "JSXIdentifier" ? name.object.name : getJsxTagName(name.object);
    const prop = name.property.name;
    return `${obj}.${prop}`;
  }
  return "Unknown";
}

/** HTML elements are lowercase; React components are PascalCase. */
function isIntrinsicTag(tag: string): boolean {
  if (!tag || tag[0] !== tag[0].toLowerCase()) return false;
  return INTRINSIC_TAGS.has(tag.toLowerCase());
}

function literalValue(
  node: Expression | null | undefined,
  constants?: Map<string, string | number>,
): string | number | boolean | undefined {
  if (!node) return undefined;
  if (node.type === "StringLiteral") return node.value;
  if (node.type === "NumericLiteral") return node.value;
  if (node.type === "BooleanLiteral") return node.value;
  if (node.type === "Identifier" && constants?.has(node.name)) {
    return constants.get(node.name);
  }
  if (node.type === "UnaryExpression" && node.operator === "-" && node.argument.type === "NumericLiteral") {
    return -node.argument.value;
  }
  return undefined;
}

function evalObjectExpression(
  expr: ObjectExpression,
  constants?: Map<string, string | number>,
): ReactStyleRecord {
  const style: ReactStyleRecord = {};
  for (const prop of expr.properties) {
    if (prop.type === "SpreadElement" || prop.type !== "ObjectProperty") continue;
    const key =
      prop.key.type === "Identifier"
        ? prop.key.name
        : prop.key.type === "StringLiteral"
          ? prop.key.value
          : null;
    if (!key) continue;
    const val = literalValue(prop.value as Expression, constants);
    if (val !== undefined && typeof val !== "boolean") style[key] = val;
    else if (prop.value.type === "StringLiteral") style[key] = prop.value.value;
    else if (prop.value.type === "NumericLiteral") style[key] = prop.value.value;
  }
  return style;
}

function parseStyleAttr(attr: JSXAttribute, constants?: Map<string, string | number>): ReactStyleRecord {
  if (!attr.value) return {};
  if (attr.value.type === "JSXExpressionContainer") {
    const ex = attr.value.expression;
    if (ex.type === "ObjectExpression") return evalObjectExpression(ex, constants);
  }
  return {};
}

function attrString(attr: JSXAttribute, constants?: Map<string, string | number>): string | undefined {
  if (!attr.value) return "";
  if (attr.value.type === "StringLiteral") return attr.value.value;
  if (attr.value.type === "JSXExpressionContainer") {
    const cn = resolveClassNameFromExpression(attr.value.expression as Expression, constants);
    if (cn) return cn;
    const v = literalValue(attr.value.expression as Expression, constants);
    if (v !== undefined) return String(v);
  }
  return undefined;
}

/** Tailwind `h-5` / `w-5` / `h-[52px]` → pixel size for icon components. */
function iconSizeFromClassName(className: string | undefined): { width: number; height: number } | null {
  if (!className) return null;
  let w: number | undefined;
  let h: number | undefined;
  for (const t of className.split(/\s+/)) {
    const wp = t.match(/^w-\[(\d+)px\]$/);
    const hp = t.match(/^h-\[(\d+)px\]$/);
    if (wp) w = parseInt(wp[1]!, 10);
    if (hp) h = parseInt(hp[1]!, 10);
    const wn = t.match(/^w-(\d+)$/);
    const hn = t.match(/^h-(\d+)$/);
    if (wn) w = parseInt(wn[1]!, 10) * 4;
    if (hn) h = parseInt(hn[1]!, 10) * 4;
  }
  if (w !== undefined && h !== undefined) return { width: w, height: h };
  if (h !== undefined) return { width: h, height: h };
  if (w !== undefined) return { width: w, height: w };
  return null;
}

type JsxAttrs = {
  id?: string;
  name?: string;
  pcType?: string;
  shape?: string;
  className?: string;
  componentTag?: string;
  style: ReactStyleRecord;
  ariaLabel?: string;
  src?: string;
};

function readJsxAttrs(
  attributes: (JSXAttribute | JSXSpreadAttribute)[],
  constants?: Map<string, string | number>,
): JsxAttrs {
  const out: JsxAttrs = { style: {} };
  for (const attr of attributes) {
    if (attr.type !== "JSXAttribute" || attr.name.type !== "JSXIdentifier") continue;
    const key = attr.name.name;
    if (key === "data-pc-id") out.id = attrString(attr, constants);
    else if (key === "data-pc-name") out.name = attrString(attr, constants);
    else if (key === "data-pc-shape") out.shape = attrString(attr, constants);
    else if (key === "data-pc-type") out.pcType = attrString(attr, constants);
    else if (key === "data-pc-component") out.componentTag = attrString(attr, constants);
    else if (key === "className") out.className = attrString(attr, constants);
    else if (key === "style") Object.assign(out.style, parseStyleAttr(attr, constants));
    else if (key === "aria-label") out.ariaLabel = attrString(attr, constants);
    else if (key === "src") out.src = attrString(attr, constants);
  }
  return out;
}

function collectModuleConstants(ast: File): Map<string, string | number> {
  const map = new Map<string, string | number>();
  for (const stmt of ast.program.body) {
    if (stmt.type !== "VariableDeclaration") continue;
    for (const d of stmt.declarations) {
      if (d.type !== "VariableDeclarator" || d.id.type !== "Identifier" || !d.init) continue;
      const v = literalValue(d.init as Expression, map);
      if (v !== undefined && (typeof v === "string" || typeof v === "number")) {
        map.set(d.id.name, v);
      }
    }
  }
  return map;
}

function collectText(children: JSXElement["children"]): string {
  let text = "";
  for (const ch of children) {
    if (ch.type === "JSXText") {
      const t = ch.value.replace(/\s+/g, " ").trim();
      if (t) text += (text ? " " : "") + t;
    } else if (ch.type === "JSXExpressionContainer" && ch.expression.type === "StringLiteral") {
      text += ch.expression.value;
    }
  }
  return text;
}

function nodeKindForTag(tag: string, shape: string | undefined, hasText: boolean, hasChildren: boolean): NodeKind {
  if (shape === "ellipse" || shape === "line" || shape === "path") return shape;
  if (shape === "rectangle") return "rectangle";
  const lower = tag.toLowerCase();
  if (lower === "img") return "image";
  if (["p", "span", "h1", "h2", "h3", "h4", "h5", "h6", "label", "a", "li"].includes(lower) && hasText && !hasChildren) {
    return "text";
  }
  if (!isIntrinsicTag(tag)) return "frame";
  if (hasChildren) return "frame";
  if (lower === "div" || lower === "section" || lower === "main") return "frame";
  return "rectangle";
}

function defaultSizeForKind(
  kind: NodeKind,
  tag: string,
  textContent?: string,
): { width: number; height: number } {
  if (kind === "text") {
    const lower = tag.toLowerCase();
    const len = textContent?.length ?? 8;
    if (lower === "h1") return { width: Math.min(358, Math.max(200, len * 16)), height: 40 };
    if (["h2", "h3", "h4", "h5", "h6"].includes(lower)) {
      return { width: Math.min(358, Math.max(160, len * 12)), height: 32 };
    }
    return { width: Math.min(358, Math.max(120, len * 8)), height: 24 };
  }
  if (kind === "image") return { width: 120, height: 120 };
  if (!isIntrinsicTag(tag)) return placeholderSizeForComponent(tag);
  return { width: 160, height: 48 };
}

/** Flatten JSX children, including `.map()` and `{cond ? <A /> : …}` blocks. */
function collectBuildableChildren(children: JSXElement["children"], ctx: BuildCtx): JSXElement[] {
  const out: JSXElement[] = [];
  let stateGuardPanels = 0;
  for (const ch of children) {
    if (ch.type === "JSXElement") {
      out.push(ch);
      continue;
    }
    if (ch.type === "JSXFragment") {
      out.push(...collectBuildableChildren(ch.children, ctx));
      continue;
    }
    if (ch.type === "JSXExpressionContainer") {
      if (ch.expression.type === "JSXEmptyExpression") continue;
      const ex = unwrapExpression(ch.expression);
      if (ex.type === "LogicalExpression" && ex.operator === "&&" && isStateEqualityGuard(ex.left)) {
        if (stateGuardPanels > 0) continue;
        stateGuardPanels += 1;
        const extracted = extractJsxFromExpression(ex.right);
        if (!extracted) continue;
        if (extracted.type === "JSXFragment") {
          out.push(...collectBuildableChildren(extracted.children, ctx));
        } else {
          out.push(extracted);
        }
        continue;
      }
      const mapped = expandMapExpression(ch.expression, ctx.arrays, ctx.constants, ctx.nestedMaps);
      if (mapped?.length) {
        out.push(...mapped);
        continue;
      }
      const extracted = extractJsxFromExpression(ch.expression);
      if (!extracted) continue;
      if (extracted.type === "JSXFragment") {
        out.push(...collectBuildableChildren(extracted.children, ctx));
      } else {
        out.push(extracted);
      }
    }
  }
  return out;
}

type BuildCtx = {
  nodes: Record<string, EditorNode>;
  childOrder: Record<string, string[]>;
  componentMap: Map<string, ComponentFn>;
  constants: Map<string, string | number>;
  arrays: import("./reactJsxImportExpand").ModuleArrays;
  nestedMaps: ModuleNestedMaps;
};

function jsxChildrenFromComponent(
  tag: string,
  componentMap: Map<string, ComponentFn>,
): Array<JSXElement | JSXFragment> {
  const fn = componentMap.get(tag);
  if (!fn) return [];
  const inner = jsxFromFunctionBody(fn);
  if (!inner) return [];
  if (inner.type === "JSXFragment") {
    return inner.children.filter(
      (c): c is JSXElement | JSXFragment => c.type === "JSXElement" || c.type === "JSXFragment",
    );
  }
  return [inner];
}

type SiblingStart = { x: number; y: number };

function stackJsxChildren(
  parentId: string,
  parentLayoutMode: LayoutMode | undefined,
  parentGap: number | undefined,
  children: JSXElement[],
  ctx: BuildCtx,
): string[] {
  const mode = parentLayoutMode ?? "vertical";
  const gap = parentGap ?? 8;
  const ids: string[] = [];
  let cursorMain = 0;
  let cursorCross = 0;
  for (let i = 0; i < children.length; i++) {
    const start: SiblingStart =
      mode === "horizontal" ? { x: cursorMain, y: cursorCross } : { x: cursorCross, y: cursorMain };
    const cid = buildNode(children[i]!, parentId, ctx, i, start);
    ids.push(cid);
    const built = ctx.nodes[cid];
    if (!built) continue;
    if (mode === "horizontal") {
      cursorMain = built.x + built.width + gap;
    } else {
      cursorMain = built.y + built.height + gap;
    }
  }
  return ids;
}

function buildNode(
  el: JSXElement | JSXFragment,
  parentId: string | null,
  ctx: BuildCtx,
  siblingIndex: number,
  siblingStart?: SiblingStart,
): string {
  if (el.type === "JSXFragment") {
    const fragId = nextId();
    const fragNode: EditorNode = {
      id: fragId,
      parentId,
      type: "frame",
      name: "Fragment",
      x: siblingStart?.x ?? 0,
      y: siblingStart?.y ?? 0,
      width: 375,
      height: 400,
      rotation: 0,
      visible: true,
      locked: false,
      expanded: true,
      layoutMode: "vertical",
      layoutGap: 0,
      fill: "#ffffff",
      fillEnabled: true,
      codeJsxTag: "Fragment",
      codeJsxIntrinsic: false,
    };
    ctx.nodes[fragId] = fragNode;
    const buildable = collectBuildableChildren(el.children, ctx);
    const kids = stackJsxChildren(fragId, "vertical", 8, buildable, ctx);
    ctx.childOrder[fragId] = kids;
    return fragId;
  }

  const rawTag = getJsxTagName(el.openingElement.name);
  const attrs = readJsxAttrs(el.openingElement.attributes, ctx.constants);
  const tag = attrs.componentTag ?? rawTag;
  const intrinsic = attrs.componentTag ? false : isIntrinsicTag(rawTag);
  const id = attrs.id && /^[\w-]+$/.test(attrs.id) ? attrs.id : nextId();
  const textContent = collectText(el.children);
  let elementChildren = collectBuildableChildren(el.children, ctx);
  if (!intrinsic && elementChildren.length === 0) {
    const fromSameFile = jsxChildrenFromComponent(tag, ctx.componentMap);
    elementChildren = fromSameFile.filter((c): c is JSXElement => c.type === "JSXElement");
  }
  const hasChildren = elementChildren.length > 0;
  const kind =
    parseNodeKindFromPcAttrs(attrs.pcType, attrs.shape) ??
    nodeKindForTag(tag, attrs.shape, !!textContent, hasChildren);
  const mergedPatch = mergeStylePatches(
    reactStyleToNodePatch(attrs.style),
    classNameToNodePatch(attrs.className),
  );
  let defaults = defaultSizeForKind(kind, tag, textContent || undefined);
  const iconSize = !intrinsic && kind === "frame" ? iconSizeFromClassName(attrs.className) : null;
  if (!intrinsic && kind === "frame") {
    if (iconSize) defaults = iconSize;
    else if (/^[A-Z]/.test(tag)) defaults = placeholderSizeForComponent(tag);
  }

  const node: EditorNode = {
    id,
    parentId,
    type: kind,
    name: attrs.name ?? tag,
    x: mergedPatch.x ?? siblingStart?.x ?? 0,
    y: mergedPatch.y ?? siblingStart?.y ?? siblingIndex * (defaults.height + 8),
    width: mergedPatch.width ?? defaults.width,
    height: mergedPatch.height ?? defaults.height,
    rotation: mergedPatch.rotation ?? 0,
    visible: true,
    locked: false,
    expanded: true,
    fill:
      mergedPatch.fill ??
      (kind === "text"
        ? undefined
        : iconSize
          ? "#e8ecf0"
          : !intrinsic && kind === "frame"
            ? "#eef2f6"
          : kind === "frame"
            ? DEFAULT_FRAME_FILL
            : DEFAULT_SHAPE_FILL),
    fillEnabled: kind !== "text",
    codeJsxTag: tag,
    codeJsxIntrinsic: intrinsic,
    codeClassName: attrs.className,
    ...mergedPatch,
  };

  if (kind === "text") {
    node.content = textContent || "Text";
    node.textColor = mergedPatch.textColor ?? node.textColor ?? "#111111";
    node.fill = node.textColor;
    node.textResizeMode = "auto-width";
  }

  if (kind === "image" && attrs.src) {
    node.imageSrc = attrs.src;
    node.imageName = tag;
  }

  if (kind === "ellipse") {
    node.cornerRadius = node.cornerRadius ?? 9999;
  }

  if (iconSize || (!intrinsic && kind === "frame" && /^[A-Z]/.test(tag))) {
    node.layoutSizingHorizontal = "fixed";
    node.layoutSizingVertical = "fixed";
    if (["Checkbox", "Badge", "Icon"].includes(tag)) {
      node.width = defaults.width;
      node.height = defaults.height;
    }
    if (iconSize) {
      node.width = iconSize.width;
      node.height = iconSize.height;
    }
  }

  ctx.nodes[id] = node;
  const childLayoutMode = mergedPatch.layoutMode ?? (elementChildren.length > 0 ? "vertical" : undefined);
  const childIds = stackJsxChildren(id, childLayoutMode, mergedPatch.layoutGap, elementChildren, ctx);
  ctx.childOrder[id] = childIds;

  if (childIds.length > 0 && !node.layoutMode) {
    node.layoutMode = "vertical";
    node.layoutGap = node.layoutGap ?? 8;
    node.counterAxisAlign = node.counterAxisAlign ?? "stretch";
  }

  if (
    (node.type === "frame" || node.type === "group") &&
    node.layoutMode &&
    node.layoutMode !== "none" &&
    node.width >= 320
  ) {
    node.counterAxisAlign = node.counterAxisAlign ?? "stretch";
  }

  return id;
}

function unwrapExpression(expr: Expression): Expression {
  if (expr.type === "ParenthesizedExpression") return unwrapExpression(expr.expression);
  if (expr.type === "TSAsExpression" || expr.type === "TSSatisfiesExpression") {
    return unwrapExpression(expr.expression);
  }
  return expr;
}

type ComponentFn = ArrowFunctionExpression | FunctionDeclaration | FunctionExpression;

function isExpressionComponentFn(
  node: Expression | null | undefined,
): node is ArrowFunctionExpression | FunctionExpression {
  return node?.type === "ArrowFunctionExpression" || node?.type === "FunctionExpression";
}

function countJsxDepth(jsx: JSXElement | JSXFragment): number {
  if (jsx.type === "JSXFragment") {
    return jsx.children.reduce((sum, ch) => {
      if (ch.type === "JSXElement" || ch.type === "JSXFragment") return sum + countJsxDepth(ch);
      return sum;
    }, 1);
  }
  return (
    1 +
    jsx.children.reduce((sum, ch) => {
      if (ch.type === "JSXElement" || ch.type === "JSXFragment") return sum + countJsxDepth(ch);
      return sum;
    }, 0)
  );
}

function pickRicherJsx(
  a: JSXElement | JSXFragment | null,
  b: JSXElement | JSXFragment | null,
): JSXElement | JSXFragment | null {
  if (!a) return b;
  if (!b) return a;
  return countJsxDepth(a) >= countJsxDepth(b) ? a : b;
}

/** Pull JSX from return values, ternaries, &&, and parenthesized groups. */
export function extractJsxFromExpression(expr: Expression | null | undefined): JSXElement | JSXFragment | null {
  if (!expr) return null;
  const e = unwrapExpression(expr);
  if (e.type === "JSXElement" || e.type === "JSXFragment") return e;
  if (e.type === "ConditionalExpression") {
    return pickRicherJsx(
      extractJsxFromExpression(e.consequent),
      extractJsxFromExpression(e.alternate),
    );
  }
  if (e.type === "LogicalExpression") {
    if (e.operator === "&&" && isStateEqualityGuard(e.left)) {
      return extractJsxFromExpression(e.right);
    }
    return pickRicherJsx(extractJsxFromExpression(e.left), extractJsxFromExpression(e.right));
  }
  return null;
}

function jsxFromFunctionBody(fn: ComponentFn): JSXElement | JSXFragment | null {
  let best: JSXElement | JSXFragment | null = null;

  const consider = (expr: Expression | null | undefined) => {
    best = pickRicherJsx(best, extractJsxFromExpression(expr));
  };

  if (fn.type === "ArrowFunctionExpression" || fn.type === "FunctionExpression") {
    const b = fn.body;
    if (b.type === "JSXElement" || b.type === "JSXFragment") return b;
    if (b.type === "BlockStatement") {
      for (const stmt of b.body) {
        if (stmt.type === "ReturnStatement") consider(stmt.argument);
      }
      return best;
    }
    return null;
  }

  for (const stmt of fn.body.body) {
    if (stmt.type === "ReturnStatement") consider(stmt.argument);
  }
  return best;
}

function collectComponentMap(ast: File): Map<string, ComponentFn> {
  const map = new Map<string, ComponentFn>();

  const add = (name: string, fn: ComponentFn) => {
    if (!map.has(name)) map.set(name, fn);
  };

  for (const stmt of ast.program.body) {
    if (stmt.type === "FunctionDeclaration" && stmt.id) add(stmt.id.name, stmt);
    if (stmt.type === "VariableDeclaration") {
      for (const d of stmt.declarations) {
        if (d.type !== "VariableDeclarator" || d.id.type !== "Identifier") continue;
        if (isExpressionComponentFn(d.init)) add(d.id.name, d.init);
      }
    }
    if (stmt.type === "ExportNamedDeclaration") {
      const decl = stmt.declaration;
      if (decl?.type === "FunctionDeclaration" && decl.id) add(decl.id.name, decl);
      if (decl?.type === "VariableDeclaration") {
        for (const d of decl.declarations) {
          if (d.type !== "VariableDeclarator" || d.id.type !== "Identifier") continue;
          if (isExpressionComponentFn(d.init)) add(d.id.name, d.init);
        }
      }
    }
  }

  return map;
}

function resolveDefaultExport(ast: File, components: Map<string, ComponentFn>): ComponentFn | null {
  for (const stmt of ast.program.body) {
    if (stmt.type !== "ExportDefaultDeclaration") continue;
    const decl = stmt.declaration;
    if (decl.type === "FunctionDeclaration") return decl;
    if (decl.type === "ArrowFunctionExpression" || decl.type === "FunctionExpression") return decl;
    if (decl.type === "Identifier") return components.get(decl.name) ?? null;
    if (decl.type === "CallExpression") {
      const inner = unwrapCallExpression(decl);
      if (inner?.type === "Identifier") return components.get(inner.name) ?? null;
      if (isExpressionComponentFn(inner)) return inner;
    }
  }
  return null;
}

type CallArgument = Expression | SpreadElement;

function unwrapCallExpression(expr: CallExpression): Expression | null {
  let cur: Expression = expr;
  for (let i = 0; i < 4; i++) {
    if (cur.type !== "CallExpression") return cur;
    const arg = cur.arguments[0] as CallArgument | undefined;
    if (!arg || arg.type === "SpreadElement") return null;
    if (arg.type === "Identifier" || isExpressionComponentFn(arg)) return arg;
    if (arg.type !== "CallExpression") return null;
    cur = arg;
  }
  return null;
}

function findComponentJsx(ast: File): { componentName: string; jsx: JSXElement | JSXFragment } | null {
  const components = collectComponentMap(ast);

  const tryFn = (name: string, fn: ComponentFn) => {
    const jsx = jsxFromFunctionBody(fn);
    return jsx ? { componentName: name, jsx } : null;
  };

  const defaultFn = resolveDefaultExport(ast, components);
  if (defaultFn) {
    const name =
      defaultFn.type === "FunctionDeclaration" && defaultFn.id
        ? defaultFn.id.name
        : defaultFn.type === "FunctionExpression" && defaultFn.id
          ? defaultFn.id.name
          : "ExportedScreen";
    const hit = tryFn(name, defaultFn);
    if (hit) return hit;
  }

  for (const stmt of ast.program.body) {
    if (stmt.type === "ExportDefaultDeclaration") {
      const decl = stmt.declaration;
      if (decl.type === "FunctionDeclaration") {
        const hit = tryFn(decl.id?.name ?? "ExportedScreen", decl);
        if (hit) return hit;
      }
    }
  }

  let best: { componentName: string; jsx: JSXElement | JSXFragment; depth: number } | null = null;
  for (const [name, fn] of components) {
    const jsx = jsxFromFunctionBody(fn);
    if (!jsx) continue;
    const depth = countJsxDepth(jsx);
    if (!best || depth > best.depth) best = { componentName: name, jsx, depth };
  }
  if (best) return { componentName: best.componentName, jsx: best.jsx };

  return null;
}

function detectWrongEntryFile(source: string): string | null {
  const t = source.trim();
  if (/createRoot\s*\(/.test(t) && /\.render\s*\(/.test(t)) {
    return [
      "This file is the app entry (main.tsx), not a screen with layout JSX.",
      "",
      "Push a screen component instead, for example:",
      "  src/screens/PMLHomePage/PMLHomePage.tsx",
      "  src/screens/PMLStocksPage/PMLStocksPage.tsx",
    ].join("\n");
  }

  const hasJsxReturn = /\breturn\s*\(?\s*</.test(t) || /=>\s*\(?\s*</.test(t);
  const onlyReExports = /export\s+\{[^}]+\}\s+from\s+['"]/.test(t) && !hasJsxReturn;
  if (onlyReExports) {
    return [
      "This file only re-exports other modules — it has no JSX to import.",
      "",
      "Push the actual screen .tsx file (the one with return ( <div>…</div> )).",
    ].join("\n");
  }

  return null;
}

function detectIncompletePaste(source: string): string | null {
  const t = source.trim();
  const hasComponent =
    /\bfunction\s+\w+/.test(t) ||
    /\bconst\s+\w+\s*=/.test(t) ||
    /export\s+default\s+function/.test(t);

  if (!hasComponent && (t.startsWith("<") || t.startsWith(")") || /^\s*<\w/.test(t))) {
    return [
      "This looks like a fragment of JSX, not the full component file.",
      "",
      "Upload or paste the entire .tsx file, including:",
      "  function PMLHomePage() { … }  (or  export default function …)",
      "  return ( <div>…</div> );",
      "  export default PMLHomePage;",
    ].join("\n");
  }

  if (/export\s+default\s+\w+\s*;?\s*$/.test(t) && !hasComponent) {
    return [
      "Only the export line was found — the component definition is missing.",
      "",
      "Paste the full .tsx file from your project (from the first import through export default).",
    ].join("\n");
  }

  return null;
}

export function extractSourceHeader(source: string): string {
  const lines = source.split("\n");
  const header: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith("import ") || t.startsWith("//") || t.startsWith("/*") || t === "" || t.startsWith("*")) {
      header.push(line);
      continue;
    }
    if (t.startsWith('"use client"') || t.startsWith("'use client'")) {
      header.push(line);
      continue;
    }
    break;
  }
  return header.join("\n").trim();
}

export function importReactFromJsx(source: string, opts?: { fileName?: string }): JsxImportResult {
  idSeq = 0;

  const pasteIssue = detectIncompletePaste(source);
  if (pasteIssue) return { ok: false, error: pasteIssue };

  const entryIssue = detectWrongEntryFile(source);
  if (entryIssue) return { ok: false, error: entryIssue };

  let ast: File;
  try {
    ast = parse(source, {
      sourceType: "module",
      plugins: ["jsx", "typescript"],
      errorRecovery: true,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const hint =
      msg.includes("Adjacent JSX") || msg.includes("Unterminated")
        ? "\n\nTip: paste the complete .tsx file (from imports through export default), not a middle snippet."
        : "";
    return { ok: false, error: `Could not parse React/TSX: ${msg}${hint}` };
  }

  const component = findComponentJsx(ast);
  if (!component) {
    return {
      ok: false,
      error: [
        "No JSX return found in this file.",
        "",
        "The importer needs a component whose return includes JSX, for example:",
        "  export default function PMLHomePage() {",
        "    return ( <div className=\"pml-home\">…</div> );",
        "  }",
        "",
        "Ternary returns (loading ? … : …) and export default ComponentName are supported.",
        "If you already edited in Paytm Craft, paste the file from Canvas → React (includes @paytm-craft-payload).",
      ].join("\n"),
    };
  }

  const componentMap = collectComponentMap(ast);
  const constants = collectModuleConstants(ast);
  const arrays = collectModuleArrays(ast, constants);
  const nestedMaps = collectModuleNestedMaps(ast, constants);
  const ctx: BuildCtx = { nodes: {}, childOrder: {}, componentMap, constants, arrays, nestedMaps };
  const rootId = buildNode(component.jsx, null, ctx, 0);
  const exportRootIds = [rootId];
  ctx.childOrder[EDITOR_ROOT_KEY] = exportRootIds;
  ctx.nodes = finalizeImportedGraph(ctx.nodes, ctx.childOrder);
  ctx.nodes = placeScreenFrameOnCanvas(ctx.nodes, exportRootIds);
  const root = ctx.nodes[rootId];
  if (!root) {
    return { ok: false, error: "Failed to build layer tree from JSX." };
  }

  const componentName = sanitizeComponentName(
    opts?.fileName?.replace(/\.[^.]+$/, "") ?? component.componentName,
  );
  const screenLabel = canvasScreenLabelFromSource(opts?.fileName ?? componentName);
  ctx.nodes[rootId] = {
    ...root,
    parentId: null,
    name: screenLabel || root.name || componentName,
  };

  const sourceHeader = extractSourceHeader(source);

  const payload: CodeRoundTripPayloadV1 = {
    version: 1,
    componentName,
    exportedAt: new Date().toISOString(),
    exportRootIds,
    nodes: ctx.nodes,
    childOrder: ctx.childOrder,
    designTokens: {},
    assets: {},
    sourceHeader: sourceHeader || undefined,
  };

  const slice = wrapPersistSliceWithPages({
    nodes: ctx.nodes,
    childOrder: ctx.childOrder,
    assets: {},
    designTokens: {},
    fileName: screenLabel || componentName,
    selectedIds: exportRootIds,
    zoom: 1,
    pan: { x: 0, y: 0 },
    showGrid: false,
    showRulers: false,
    canvasBackgroundColor: DEFAULT_CANVAS_BACKGROUND,
    comments: [],
  });

  const count = Object.keys(ctx.nodes).length;
  return {
    ok: true,
    slice,
    payload,
    message: `Converted JSX to ${count} editable layer(s) (${componentName}). Edit on canvas, then export to get updated React with the same mapping.`,
  };
}

/** Build a full .tsx string from graph (used after JSX-only import path). */
export function buildReactSourceFromPayload(payload: CodeRoundTripPayloadV1, bodyJsx: string): string {
  const payloadJson = JSON.stringify(payload, null, 2);
  const header = payload.sourceHeader ? `${payload.sourceHeader}\n\n` : "";
  const useClient =
    payload.sourceHeader?.includes("use client") ? "" : `"use client";\n\nimport React from "react";\n\n`;

  return `/**
 * Paytm Craft — Design ↔ Code
 * Layers map 1:1 via data-pc-id and the payload block below.
 */

${formatCodeRoundTripPayloadBlock(payloadJson)}

${header}${useClient}export function ${payload.componentName}() {
  return (
${bodyJsx}
  );
}

export default ${payload.componentName};
`;
}
