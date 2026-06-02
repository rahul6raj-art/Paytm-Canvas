import type { LayoutMode, PrimaryAxisAlign, CrossAxisAlign } from "@/lib/autoLayout";

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
  color?: string;
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string;
  lineHeight?: string;
  textAlign?: string;
  border?: string;
  borderRadius?: string;
  boxShadow?: string;
  opacity?: string;
  objectFit?: string;
  flexDirection?: string;
  gap?: string;
  paddingTop?: string;
  paddingRight?: string;
  paddingBottom?: string;
  paddingLeft?: string;
  justifyContent?: string;
  alignItems?: string;
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
  svgMarkup?: string;
  inputValue?: string;
  placeholder?: string;
  ariaLabel?: string;
  rect: DomSnapshotRect;
  styles: DomSnapshotStyles;
  children: DomSnapshotNode[];
  sectionHint?: "header" | "nav" | "hero" | "features" | "cards" | "form" | "footer" | "content";
  componentHint?: "button" | "card" | "input" | "link" | "image" | "text";
}

export interface DetectedSection {
  id: string;
  kind: DomSnapshotNode["sectionHint"];
  name: string;
  nodeIds: string[];
}

export interface ImportWebSceneNode {
  id: string;
  type: "frame" | "group" | "rectangle" | "text" | "image" | "ellipse";
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
  strokeColor?: string;
  strokeWidth?: number;
  cornerRadius?: number;
  opacity?: number;
  content?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  textAlign?: "left" | "center" | "right";
  imageSrc?: string;
  assetId?: string;
  layoutMode?: LayoutMode;
  layoutGap?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  primaryAxisAlign?: PrimaryAxisAlign;
  counterAxisAlign?: CrossAxisAlign;
  clipChildren?: boolean;
  /** Screenshot reference under imported content */
  isImportReference?: boolean;
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
