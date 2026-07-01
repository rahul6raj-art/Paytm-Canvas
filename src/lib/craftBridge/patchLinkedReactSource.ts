import {
  buildCanvasAdditionsJsx,
  collectCanvasAdditionLeafIds,
  findBridgeScreenRootForSource,
  patchCanvasAdditionsIntoReactSource,
} from "@/lib/craftBridge/exportCanvasAdditions";
import type { CanvasColorMode, DesignToken } from "@/lib/designTokens";
import type { EditorNode } from "@/stores/useEditorStore";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeJsxAttr(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function sortedTextNodes(nodes: Record<string, EditorNode>): EditorNode[] {
  return Object.values(nodes)
    .filter((n) => n.type === "text" && n.content?.trim())
    .sort((a, b) => a.y - b.y || a.x - b.x);
}

function nodesWithClass(nodes: Record<string, EditorNode>, token: string): EditorNode[] {
  return sortedTextNodes(nodes).filter((n) => (n.codeClassName ?? "").includes(token));
}

function replaceOrderedJsxProps(
  source: string,
  propName: string,
  values: string[],
): string {
  if (values.length === 0) return source;
  let index = 0;
  const re = new RegExp(`${propName}=(["'])([^"']*)\\1`, "g");
  return source.replace(re, (match, quote: string) => {
    if (index >= values.length) return match;
    const next = `${propName}=${quote}${escapeJsxAttr(values[index]!)}${quote}`;
    index += 1;
    return next;
  });
}

function replaceComponentProp(
  source: string,
  componentTag: string,
  propName: string,
  value: string,
): string {
  const re = new RegExp(
    `(<${componentTag}[\\s\\S]*?\\b${propName}=)(["'])([^"']*)\\2`,
  );
  return source.replace(re, `$1$2${escapeJsxAttr(value)}$2`);
}

const PROP_PATCHED_CLASS_TOKENS = new Set([
  "header__bar-title",
  "sh__title",
  "pml-more-theme-card__label",
  "li-item__primary",
  "li-item__secondary",
]);

function primaryClassToken(codeClassName: string): string | null {
  const tokens = codeClassName.split(/\s+/).filter(Boolean);
  const semantic = tokens.find(
    (t) => t.includes("__") && !/^body-|^sh$/.test(t),
  );
  return semantic ?? tokens[0] ?? null;
}

function patchOrderedInnerTextByClass(
  source: string,
  classToken: string,
  texts: string[],
): string {
  if (texts.length === 0) return source;
  let index = 0;
  const re = new RegExp(
    `(className=(["'][^"']*\\b${escapeRegExp(classToken)}\\b[^"']*["'])[^>]*>)([^<]*)`,
    "g",
  );
  return source.replace(re, (match, prefix: string) => {
    if (index >= texts.length) return match;
    const next = `${prefix}${texts[index]!}`;
    index += 1;
    return next;
  });
}

function patchGenericTextNodes(
  source: string,
  nodes: Record<string, EditorNode>,
): string {
  const groups = new Map<string, string[]>();
  for (const node of sortedTextNodes(nodes)) {
    const cls = primaryClassToken(node.codeClassName ?? "");
    if (!cls || PROP_PATCHED_CLASS_TOKENS.has(cls)) continue;
    const list = groups.get(cls) ?? [];
    list.push(node.content!.trim());
    groups.set(cls, list);
  }

  let result = source;
  for (const [cls, texts] of groups) {
    result = patchOrderedInnerTextByClass(result, cls, texts);
  }
  return result;
}

function replaceSpanTextByClass(source: string, classToken: string, value: string): string {
  const re = new RegExp(
    `(className=(["'][^"']*\\b${escapeRegExp(classToken)}\\b[^"']*["'])[^>]*>)([^<]*)`,
  );
  return source.replace(re, `$1${value}`);
}

export type PatchLinkedReactSourceOptions = {
  childOrder?: Record<string, string[]>;
  designTokens?: Record<string, DesignToken>;
  sourcePath?: string;
  canvasColorMode?: CanvasColorMode;
  cssSources?: string[];
  /** When true, only inject @craft-canvas-additions (no text prop patches). */
  additionsOnly?: boolean;
  /** Skip bn__label / generic class text rewrites — they break nav layout. Default true on bridge export. */
  skipGenericTextPatches?: boolean;
};

function patchCanvasAdditionsBlock(
  sourceCode: string,
  nodes: Record<string, EditorNode>,
  opts: PatchLinkedReactSourceOptions,
): string {
  if (!opts.childOrder || !opts.sourcePath?.trim()) return sourceCode;
  const screenRootId = findBridgeScreenRootForSource(nodes, opts.sourcePath);
  if (!screenRootId) return sourceCode;
  const additionRoots = collectCanvasAdditionLeafIds(
    screenRootId,
    nodes,
    opts.childOrder,
  );
  const additionsJsx = buildCanvasAdditionsJsx(
    additionRoots,
    screenRootId,
    nodes,
    opts.childOrder,
    opts.designTokens ?? {},
    opts.canvasColorMode ?? "light",
    opts.cssSources ?? [],
  );
  return patchCanvasAdditionsIntoReactSource(sourceCode, additionsJsx);
}

/** Patch text/props and canvas-added layers in an existing React screen file. */
export function patchLinkedReactSourceFromCanvas(
  sourceCode: string,
  nodes: Record<string, EditorNode>,
  opts?: PatchLinkedReactSourceOptions,
): string {
  if (opts?.additionsOnly) {
    return patchCanvasAdditionsBlock(sourceCode, nodes, opts ?? {});
  }

  let result = sourceCode;

  const headerTitle = nodesWithClass(nodes, "header__bar-title")[0];
  if (headerTitle?.content) {
    result = replaceComponentProp(result, "Header", "title", headerTitle.content.trim());
  }

  const sectionTitles = nodesWithClass(nodes, "sh__title").map((n) => n.content!.trim());
  if (sectionTitles.length > 0) {
    let index = 0;
    result = result.replace(
      /(<SectionHeader[\s\S]*?\btitle=)(["'])([^"']*)\2/g,
      (match, prefix: string, quote: string) => {
        if (index >= sectionTitles.length) return match;
        const next = `${prefix}${quote}${escapeJsxAttr(sectionTitles[index]!)}${quote}`;
        index += 1;
        return next;
      },
    );
  }

  const themeLabel = nodesWithClass(nodes, "pml-more-theme-card__label")[0];
  if (themeLabel?.content) {
    result = replaceSpanTextByClass(
      result,
      "pml-more-theme-card__label",
      themeLabel.content.trim(),
    );
  }

  const primaryTexts = nodesWithClass(nodes, "li-item__primary").map((n) => n.content!.trim());
  result = replaceOrderedJsxProps(result, "primaryText", primaryTexts);

  const secondaryTexts = nodesWithClass(nodes, "li-item__secondary").map((n) => n.content!.trim());
  result = replaceOrderedJsxProps(result, "secondaryText", secondaryTexts);

  if (!opts?.skipGenericTextPatches) {
    result = patchGenericTextNodes(result, nodes);
  }

  return patchCanvasAdditionsBlock(result, nodes, opts ?? {});
}
