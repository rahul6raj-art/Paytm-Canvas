/** Minimal Figma REST API node shapes used by the importer. */

export type FigmaLayoutSizing = "FIXED" | "HUG" | "FILL";
export type FigmaLayoutMode = "NONE" | "HORIZONTAL" | "VERTICAL" | "GRID";
export type FigmaPrimaryAxisSizing = "FIXED" | "AUTO";

export interface FigmaColor {
  r: number;
  g: number;
  b: number;
  a?: number;
}

export interface FigmaPaint {
  type?: string;
  visible?: boolean;
  opacity?: number;
  color?: FigmaColor;
  blendMode?: string;
  gradientHandlePositions?: { x: number; y: number }[];
  gradientStops?: { position: number; color: FigmaColor }[];
  imageRef?: string;
  scaleMode?: string;
}

export interface FigmaRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FigmaTypeStyle {
  fontFamily?: string;
  fontPostScriptName?: string;
  fontSize?: number;
  fontWeight?: number;
  lineHeightPx?: number;
  letterSpacing?: number;
  textAlignHorizontal?: "LEFT" | "CENTER" | "RIGHT" | "JUSTIFIED";
}

export interface FigmaOverride {
  id: string;
  overriddenFields?: string[];
}

export interface FigmaApiNode {
  id: string;
  name?: string;
  type: string;
  visible?: boolean;
  locked?: boolean;
  opacity?: number;
  blendMode?: string;
  absoluteBoundingBox?: FigmaRect;
  fills?: FigmaPaint[];
  strokes?: FigmaPaint[];
  strokeWeight?: number;
  effects?: unknown[];
  cornerRadius?: number;
  rectangleCornerRadii?: [number, number, number, number];
  layoutMode?: FigmaLayoutMode;
  primaryAxisSizingMode?: FigmaPrimaryAxisSizing;
  counterAxisSizingMode?: FigmaPrimaryAxisSizing;
  primaryAxisAlignItems?: string;
  counterAxisAlignItems?: string;
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  itemSpacing?: number;
  layoutWrap?: string;
  layoutSizingHorizontal?: FigmaLayoutSizing;
  layoutSizingVertical?: FigmaLayoutSizing;
  layoutGrow?: number;
  constraints?: { vertical?: string; horizontal?: string };
  characters?: string;
  style?: FigmaTypeStyle;
  componentId?: string;
  overrides?: FigmaOverride[];
  children?: FigmaApiNode[];
  clipsContent?: boolean;
  fillGeometry?: { path: string }[];
  strokeGeometry?: { path: string }[];
}

export interface FigmaNodesResponse {
  name?: string;
  nodes: Record<
    string,
    {
      document: FigmaApiNode | null;
      components?: Record<string, { key: string; name: string }>;
      componentSets?: Record<string, unknown>;
      styles?: Record<string, unknown>;
    } | null
  >;
}

export interface FigmaFileResponse {
  name?: string;
  document: FigmaApiNode;
  components?: Record<string, { key: string; name: string }>;
}

export interface FigmaImagesResponse {
  images: Record<string, string | null>;
}

export interface ImportFigmaApiRequest {
  /** Optional when `FIGMA_ACCESS_TOKEN` is set on the server. */
  accessToken?: string;
  url?: string;
  fileKey?: string;
  nodeId?: string;
}

export interface ParsedFigmaUrl {
  fileKey: string;
  nodeId?: string;
}

export type FigmaApiImportResult =
  | { ok: true; document: import("@/lib/documentPersistence").PaytmCraftDocument }
  | { ok: false; error: string };
