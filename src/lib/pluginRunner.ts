import { collectSubtreeIds } from "@/lib/editorGraph";
import { worldRect } from "@/lib/tree";
import type { EditorNode } from "@/stores/useEditorStore";

export interface SelectionSummaryLine {
  label: string;
  value: string;
}

export function summarizeSelection(
  selectedIds: string[],
  nodes: Record<string, EditorNode>,
): SelectionSummaryLine[] {
  if (selectedIds.length === 0) {
    return [{ label: "Selection", value: "Nothing selected — pick layers on the canvas." }];
  }
  const lines: SelectionSummaryLine[] = [];
  for (const id of selectedIds.slice(0, 6)) {
    const n = nodes[id];
    if (!n) continue;
    const wr = worldRect(id, nodes);
    lines.push({
      label: n.name || n.type,
      value: `${n.type} · ${Math.round(wr.width)}×${Math.round(wr.height)}`,
    });
  }
  if (selectedIds.length > 6) {
    lines.push({ label: "…", value: `${selectedIds.length - 6} more` });
  }
  return lines;
}

function parseHexColor(input: string | undefined): [number, number, number] | null {
  if (!input || typeof input !== "string") return null;
  let h = input.trim();
  if (h.startsWith("#")) h = h.slice(1);
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (h.length !== 6) return null;
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return null;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const R = channel(r);
  const G = channel(g);
  const B = channel(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

export function contrastRatioBetweenHex(a: string, b: string): number | null {
  const A = parseHexColor(a);
  const B = parseHexColor(b);
  if (!A || !B) return null;
  const l1 = relativeLuminance(A);
  const l2 = relativeLuminance(B);
  const L = Math.max(l1, l2);
  const S = Math.min(l1, l2);
  return (L + 0.05) / (S + 0.05);
}

export function wcagLevel(ratio: number): { aaNormal: boolean; aaLarge: boolean; aaaNormal: boolean } {
  return {
    aaNormal: ratio >= 4.5,
    aaLarge: ratio >= 3,
    aaaNormal: ratio >= 7,
  };
}

function firstBackgroundFromSelection(
  selectedIds: string[],
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): string {
  const seen = new Set<string>();
  for (const sid of selectedIds) {
    for (const tid of collectSubtreeIds(sid, childOrder)) {
      if (seen.has(tid)) continue;
      seen.add(tid);
      const n = nodes[tid];
      if (!n) continue;
      if (
        (n.type === "frame" || n.type === "rectangle" || n.type === "ellipse") &&
        n.fill &&
        n.fillEnabled !== false
      ) {
        return n.fill;
      }
    }
  }
  return "#ffffff";
}

export function contrastReportFromSelection(
  selectedIds: string[],
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): {
  foreground: string;
  background: string;
  ratio: number | null;
  wcag: { aaNormal: boolean; aaLarge: boolean; aaaNormal: boolean } | null;
  note: string;
} {
  if (selectedIds.length === 0) {
    return {
      foreground: "#0f172a",
      background: "#ffffff",
      ratio: null,
      wcag: null,
      note: "Select a text layer and a surface (frame/rectangle) to estimate contrast.",
    };
  }

  let fg = "#0f172a";
  let foundText = false;
  outer: for (const sid of selectedIds) {
    for (const tid of collectSubtreeIds(sid, childOrder)) {
      const n = nodes[tid];
      if (n?.type === "text") {
        const tc = n.textColor ?? n.fill;
        if (tc) {
          fg = tc;
          foundText = true;
          break outer;
        }
      }
    }
  }
  if (!foundText) {
    const n = nodes[selectedIds[0]!];
    const tc = n?.textColor ?? n?.fill;
    if (tc) fg = tc;
  }

  const bg = firstBackgroundFromSelection(selectedIds, nodes, childOrder);
  const ratio = contrastRatioBetweenHex(fg, bg);
  const wcag = ratio != null ? wcagLevel(ratio) : null;
  const note =
    ratio == null
      ? "Could not parse colors — pick layers with hex fills or text colors."
      : ratio >= 4.5
        ? "Likely passes WCAG AA for normal text (mock estimate)."
        : ratio >= 3
          ? "May pass AA for large text only — tighten palette for body copy."
          : "Low contrast — increase separation between text and surface.";

  return { foreground: fg, background: bg, ratio, wcag, note };
}

export interface TokenRow {
  kind: "color" | "fontSize" | "spacing";
  value: string;
  count: number;
}

export function extractDesignTokens(nodes: Record<string, EditorNode>): TokenRow[] {
  const colors = new Map<string, number>();
  const sizes = new Map<string, number>();
  const gaps = new Map<string, number>();

  for (const n of Object.values(nodes)) {
    if (n.fill && n.fillEnabled !== false) {
      colors.set(n.fill, (colors.get(n.fill) ?? 0) + 1);
    }
    if (n.strokeColor) {
      colors.set(n.strokeColor, (colors.get(n.strokeColor) ?? 0) + 1);
    }
    if (n.textColor) {
      colors.set(n.textColor, (colors.get(n.textColor) ?? 0) + 1);
    }
    if (typeof n.fontSize === "number") {
      const k = `${n.fontSize}px`;
      sizes.set(k, (sizes.get(k) ?? 0) + 1);
    }
    if (typeof n.layoutGap === "number" && n.layoutGap > 0) {
      const k = `gap ${n.layoutGap}px`;
      gaps.set(k, (gaps.get(k) ?? 0) + 1);
    }
    const pads = [n.paddingTop, n.paddingRight, n.paddingBottom, n.paddingLeft].filter(
      (x): x is number => typeof x === "number" && x > 0,
    );
    for (const p of pads) {
      const k = `padding ${p}px`;
      gaps.set(k, (gaps.get(k) ?? 0) + 1);
    }
  }

  const rows: TokenRow[] = [];
  for (const [value, count] of [...colors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
    rows.push({ kind: "color", value, count });
  }
  for (const [value, count] of [...sizes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)) {
    rows.push({ kind: "fontSize", value, count });
  }
  for (const [value, count] of [...gaps.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)) {
    rows.push({ kind: "spacing", value, count });
  }
  return rows;
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function nodeToJsx(
  n: EditorNode,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  depth: number,
): string {
  const pad = "  ".repeat(depth);
  const kids = childOrder[n.id] ?? [];
  const style: string[] = [];
  if (n.fill && n.fillEnabled !== false) style.push(`background: '${n.fill}'`);
  if (n.cornerRadius) style.push(`borderRadius: ${n.cornerRadius}`);
  if (n.width) style.push(`width: ${Math.round(n.width)}`);
  if (n.height) style.push(`height: ${Math.round(n.height)}`);
  const styleStr = style.length ? ` style={{ ${style.join(", ")} }}` : "";
  const cls = JSON.stringify(n.name || "layer");
  switch (n.type) {
    case "frame":
    case "group":
      if (kids.length === 0) return `${pad}<div className={${cls}}${styleStr} />\n`;
      return `${pad}<div className={${cls}}${styleStr}>\n${kids
        .map((cid) => {
          const c = nodes[cid];
          return c ? nodeToJsx(c, nodes, childOrder, depth + 1) : "";
        })
        .join("")}${pad}</div>\n`;
    case "text":
      return `${pad}<p${styleStr}>{${JSON.stringify(n.content ?? "")}}</p>\n`;
    case "rectangle":
    case "ellipse":
      return `${pad}<div data-shape="${escapeAttr(n.type)}"${styleStr} />\n`;
    default:
      return `${pad}<div data-node="${escapeAttr(n.type)}"${styleStr} />\n`;
  }
}

export function reactExportPreview(
  selectedIds: string[],
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): string {
  const id =
    selectedIds.find((sid) => nodes[sid]?.type === "frame") ??
    selectedIds.find((sid) => nodes[sid]?.type === "group") ??
    selectedIds[0];
  if (!id || !nodes[id]) {
    return "// Select a frame or group to preview JSX.\nexport function Preview() {\n  return <div />;\n}\n";
  }
  const body = nodeToJsx(nodes[id]!, nodes, childOrder, 1);
  return `// Mock export — adapt to your design system\nexport function ${sanitizeComponentName(nodes[id]!.name)}() {\n  return (\n${body}  );\n}\n`;
}

function sanitizeComponentName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9]+/g, "");
  const base = cleaned.length ? cleaned : "Generated";
  return base.charAt(0).toUpperCase() + base.slice(1);
}

export interface AuditItem {
  severity: "info" | "warn" | "pass";
  title: string;
  detail: string;
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function accessibilityAuditMock(
  fileName: string,
  selectedIds: string[],
  nodes: Record<string, EditorNode>,
): AuditItem[] {
  const h = hashString(fileName + selectedIds.join(",") + Object.keys(nodes).length);
  const items: AuditItem[] = [
    {
      severity: "pass",
      title: "Semantic structure",
      detail: "Frames are treated as layout regions — keep nesting shallow for assistive tech handoff.",
    },
    {
      severity: (h % 3 === 0 ? "warn" : "info") as AuditItem["severity"],
      title: "Tap targets",
      detail:
        h % 3 === 0
          ? "Some controls under 44×44px in selection — enlarge hit areas for mobile."
          : "No undersized controls detected in the current mock scan.",
    },
    {
      severity: (h % 5 === 0 ? "warn" : "pass") as AuditItem["severity"],
      title: "Color independence",
      detail:
        h % 5 === 0
          ? "Charts may rely on color alone — add patterns or labels for differentiation."
          : "Mock scan did not find obvious color-only encoding in selection.",
    },
    {
      severity: "info",
      title: "Motion",
      detail: "Respect prefers-reduced-motion for large transitions (plugin mock recommendation).",
    },
  ];
  return items;
}
