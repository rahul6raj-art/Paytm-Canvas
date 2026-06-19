import type { LayoutMode, PrimaryAxisAlign, CrossAxisAlign, LayoutSizingMode } from "@/lib/autoLayout";
import type { CornerRadii } from "@/lib/cornerRadius";
import type { FillGradient, FillType } from "@/lib/fillGradient";
import type { NodeEffect } from "@/lib/nodeEffects";

export type ImportWebMode = "editable" | "screenshot" | "editable_with_reference";

export type ViewportPresetId = "desktop" | "tablet" | "mobile" | "custom";

export interface ImportWebViewport {
  width: number;
  height: number;
}

export interface ImportWebRequest {
  url?: string;
  html?: string;
  mode: ImportWebMode;
  viewport: ImportWebViewport;
  /** When `react-preview`, localhost / 127.0.0.1 are allowed (Storybook, dev server). */
  urlPolicy?: "public" | "react-preview";
}

export interface ImportWebPageMeta {
  title: string;
  url: string | null;
  width: number;
  height: number;
}

export interface ImportWebScreenshot {
  dataUrl: string;
  width: number;
  height: number;
}

export interface DomSnapshotStyles {
  display?: string;
  position?: string;
  backgroundColor?: string;
  backgroundImage?: string;
  backgroundSize?: string;
  color?: string;
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string;
  fontStyle?: string;
  lineHeight?: string;
  letterSpacing?: string;
  textDecoration?: string;
  textTransform?: string;
  textAlign?: string;
  verticalAlign?: string;
  whiteSpace?: string;
  border?: string;
  borderTopWidth?: string;
  borderRightWidth?: string;
  borderBottomWidth?: string;
  borderLeftWidth?: string;
  borderTopColor?: string;
  borderRightColor?: string;
  borderBottomColor?: string;
  borderLeftColor?: string;
  borderRadius?: string;
  borderTopLeftRadius?: string;
  borderTopRightRadius?: string;
  borderBottomRightRadius?: string;
  borderBottomLeftRadius?: string;
  boxShadow?: string;
  outlineWidth?: string;
  outlineColor?: string;
  outlineStyle?: string;
  opacity?: string;
  mixBlendMode?: string;
  filter?: string;
  backdropFilter?: string;
  transform?: string;
  objectFit?: string;
  overflow?: string;
  width?: string;
  height?: string;
  minWidth?: string;
  maxWidth?: string;
  minHeight?: string;
  maxHeight?: string;
  top?: string;
  left?: string;
  right?: string;
  bottom?: string;
  flexDirection?: string;
  flexWrap?: string;
  flexGrow?: string;
  flexShrink?: string;
  flexBasis?: string;
  alignSelf?: string;
  order?: string;
  gap?: string;
  rowGap?: string;
  columnGap?: string;
  paddingTop?: string;
  paddingRight?: string;
  paddingBottom?: string;
  paddingLeft?: string;
  justifyContent?: string;
  alignItems?: string;
  alignContent?: string;
  gridTemplateColumns?: string;
  gridTemplateRows?: string;
  gridAutoFlow?: string;
  gridColumn?: string;
  gridRow?: string;
  boxSizing?: string;
  zIndex?: string;
}

export interface DomSnapshotRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DomSnapshotNode {
  id: string;
  tagName: string;
  /** HTML class attribute (for Design ↔ Code export round-trip) */
  className?: string;
  role?: string;
  text?: string;
  href?: string;
  src?: string;
  /** Raster URL from CSS background-image (when not a gradient). */
  backgroundImageSrc?: string;
  svgMarkup?: string;
  inputValue?: string;
  placeholder?: string;
  ariaLabel?: string;
  rect: DomSnapshotRect;
  styles: DomSnapshotStyles;
  children: DomSnapshotNode[];
  sectionHint?: "header" | "nav" | "hero" | "features" | "cards" | "form" | "footer" | "content";
  componentHint?: "button" | "card" | "input" | "link" | "image" | "text";
  /** Pseudo-element layers (::before / ::after) */
  pseudoElements?: DomPseudoElement[];
}

export interface DomPseudoElement {
  kind: "before" | "after";
  rect: DomSnapshotRect;
  styles: DomSnapshotStyles;
  text?: string;
}

export type SemanticRole =
  | "button"
  | "card"
  | "navbar"
  | "sidebar"
  | "avatar"
  | "input"
  | "dropdown"
  | "badge"
  | "list-item"
  | "modal"
  | "link"
  | "image"
  | "text"
  | "header"
  | "footer"
  | "nav"
  | "hero"
  | "section"
  | "content";

export type LayoutKind = "flex" | "grid" | "stack" | "inline" | "absolute" | "none";

export interface DesignLayout {
  kind: LayoutKind;
  layoutMode?: LayoutMode;
  layoutGap?: number;
  layoutWrap?: boolean;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  primaryAxisAlign?: PrimaryAxisAlign;
  counterAxisAlign?: CrossAxisAlign;
  layoutPositioning?: "auto" | "absolute";
  layoutSizingHorizontal?: LayoutSizingMode;
  layoutSizingVertical?: LayoutSizingMode;
  layoutGrow?: number;
  gridTemplateColumns?: string;
  gridTemplateRows?: string;
  gridGap?: number;
}

export interface ExtractedTypography {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  fontStyle?: string;
  lineHeight?: number;
  letterSpacing?: number;
  textAlign?: "left" | "center" | "right";
  textDecoration?: string;
  textTransform?: string;
  verticalAlign?: "top" | "middle" | "bottom";
  color?: string;
}

export interface ExtractedVisualStyle {
  fill?: string;
  fillEnabled?: boolean;
  fillOpacity?: number;
  fillType?: FillType;
  fillGradient?: FillGradient;
  strokeColor?: string;
  strokeWidth?: number;
  strokeEnabled?: boolean;
  cornerRadius?: number;
  cornerRadii?: CornerRadii;
  opacity?: number;
  blendMode?: string;
  effects?: NodeEffect[];
  imageFitMode?: EditorImageFit;
}

export type EditorImageFit = "fill" | "fit" | "crop" | "tile";

export interface DesignNode {
  id: string;
  domId: string;
  tagName: string;
  name: string;
  role?: SemanticRole;
  bounds: DomSnapshotRect;
  layout: DesignLayout;
  style: ExtractedVisualStyle;
  typography?: ExtractedTypography;
  text?: string;
  /** Raw CSS hints for text resize mode on web import. */
  cssLayoutHints?: {
    width?: string;
    maxWidth?: string;
    whiteSpace?: string;
    overflowWrap?: string;
    wordBreak?: string;
  };
  href?: string;
  /** `<img>` src only — not CSS background-image. */
  imageSrc?: string;
  backgroundImageSrc?: string;
  backgroundSize?: string;
  overflowHidden?: boolean;
  svgMarkup?: string;
  placeholder?: string;
  inputValue?: string;
  ariaLabel?: string;
  codeClassName?: string;
  codeJsxTag?: string;
  codeJsxIntrinsic?: boolean;
  children: DesignNode[];
  componentSignature?: string;
  isComponentMaster?: boolean;
  componentId?: string;
  sourceComponentId?: string;
}

export interface WebImportFidelityReport {
  score: number;
  layoutScore: number;
  typographyScore: number;
  visualScore: number;
  componentScore: number;
  autoLayoutFrames: number;
  flexContainers: number;
  gridContainers: number;
  textNodes: number;
  imageNodes: number;
  vectorNodes: number;
  componentMasters: number;
  componentInstances: number;
  absoluteNodes: number;
  hugSizingNodes: number;
  fillSizingNodes: number;
  warnings: string[];
}

export interface DetectedSection {
  id: string;
  kind: DomSnapshotNode["sectionHint"];
  name: string;
  nodeIds: string[];
}

export interface ImportWebSceneNode {
  id: string;
  type: "frame" | "group" | "rectangle" | "text" | "image" | "ellipse" | "path";
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  visible?: boolean;
  locked?: boolean;
  expanded?: boolean;
  fill?: string;
  fillEnabled?: boolean;
  fillOpacity?: number;
  fillType?: FillType;
  fillGradient?: FillGradient;
  strokeColor?: string;
  strokeWidth?: number;
  strokeEnabled?: boolean;
  cornerRadius?: number;
  cornerRadii?: CornerRadii;
  opacity?: number;
  effects?: NodeEffect[];
  content?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  lineHeight?: number;
  letterSpacing?: number;
  textDecoration?: string;
  textAlign?: "left" | "center" | "right";
  verticalAlign?: "top" | "middle" | "bottom";
  textResizeMode?: "auto-width" | "auto-height" | "fixed";
  imageSrc?: string;
  imageFitMode?: EditorImageFit;
  assetId?: string;
  pathPoints?: import("@/lib/pathGeometry").PathPoint[];
  pathClosed?: boolean;
  pathFillRule?: "nonzero" | "evenodd";
  flattenedPathData?: string;
  strokeLinecap?: import("@/stores/useEditorStore").EditorNode["strokeLinecap"];
  strokeLinejoin?: import("@/stores/useEditorStore").EditorNode["strokeLinejoin"];
  strokeOpacity?: number;
  layoutMode?: LayoutMode;
  layoutGap?: number;
  layoutWrap?: boolean;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  primaryAxisAlign?: PrimaryAxisAlign;
  counterAxisAlign?: CrossAxisAlign;
  layoutPositioning?: "auto" | "absolute";
  layoutSizingHorizontal?: LayoutSizingMode;
  layoutSizingVertical?: LayoutSizingMode;
  layoutGrow?: number;
  clipChildren?: boolean;
  isComponent?: boolean;
  componentId?: string;
  sourceComponentId?: string;
  /** Screenshot reference under imported content */
  isImportReference?: boolean;
  /**
   * Synthesized control/icon frame whose children sit at the origin and depend
   * on auto-layout to position. Structural frames are flattened to manual
   * layout to preserve browser-measured positions; marked frames are not.
   */
  preserveAutoLayout?: boolean;
  /** Design ↔ Code: original className from DOM */
  codeClassName?: string;
  codeJsxTag?: string;
  codeJsxIntrinsic?: boolean;
  children?: ImportWebSceneNode[];
}

/** Canvas scene node produced by web import (alias for editor compatibility). */
export type CanvasNode = ImportWebSceneNode;
export type FrameNode = ImportWebSceneNode & { type: "frame" };
export type TextNode = ImportWebSceneNode & { type: "text" };
export type ImageNode = ImportWebSceneNode & { type: "image" };
export type VectorNode = ImportWebSceneNode & { type: "rectangle" };
export type ComponentNode = ImportWebSceneNode;
export type InstanceNode = ImportWebSceneNode;

export interface ImportWebWebAsset {
  id: string;
  name: string;
  mimeType: string;
  dataUrl: string;
}

export interface ImportWebResponse {
  page: ImportWebPageMeta;
  screenshot: ImportWebScreenshot | null;
  sections: DetectedSection[];
  scene: ImportWebSceneNode;
  mode: ImportWebMode;
  assets: Record<string, ImportWebWebAsset>;
  fidelity?: WebImportFidelityReport;
}

export const IMPORT_WEB_LIMITS = {
  maxNodes: 2500,
  maxPageHeight: 24_000,
  maxScreenshotBytes: 8 * 1024 * 1024,
  navigationTimeoutMs: 45_000,
  maxTextLength: 8_000,
} as const;

export const VIEWPORT_PRESETS: Record<
  Exclude<ViewportPresetId, "custom">,
  ImportWebViewport
> = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 390, height: 844 },
};
