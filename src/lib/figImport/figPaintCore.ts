import type { FigNode, FigPaint } from "openfig-core";

export type FigColor = { r: number; g: number; b: number; a?: number };

export type FigStyleOverride = {
  styleID?: number;
  fillPaints?: FigPaint[];
  strokePaints?: FigPaint[];
  fontName?: FigNode["fontName"];
  fontSize?: number;
};

const PAINT_TYPE_BY_NUMBER: Record<number, string> = {
  0: "SOLID",
  1: "GRADIENT_LINEAR",
  2: "GRADIENT_RADIAL",
  3: "GRADIENT_ANGULAR",
  4: "GRADIENT_DIAMOND",
  5: "IMAGE",
  6: "EMOJI",
  7: "VIDEO",
};

export function normalizePaintType(type: unknown): string {
  if (typeof type === "number") return PAINT_TYPE_BY_NUMBER[type] ?? String(type);
  if (typeof type === "string") return type.toUpperCase();
  return "";
}

export function normalizePaints(paints?: FigPaint[]): FigPaint[] | undefined {
  if (!paints?.length) return paints;
  return paints.map((p) => ({ ...p, type: normalizePaintType(p.type) || p.type }));
}

export function figStyleOverrideTable(node: FigNode): FigStyleOverride[] {
  const ext = node as FigNode & {
    styleOverrideTable?: FigStyleOverride[];
    vectorData?: { styleOverrideTable?: FigStyleOverride[] };
    textData?: { styleOverrideTable?: FigStyleOverride[] };
  };
  const table =
    ext.styleOverrideTable ??
    ext.vectorData?.styleOverrideTable ??
    ext.textData?.styleOverrideTable;
  return Array.isArray(table) ? table : [];
}
