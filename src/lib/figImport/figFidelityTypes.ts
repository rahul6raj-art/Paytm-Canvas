export type FidelityCategory =
  | "geometry"
  | "transform"
  | "fill"
  | "gradient"
  | "stroke"
  | "cornerRadius"
  | "effects"
  | "text"
  | "constraints"
  | "autoLayout"
  | "component"
  | "variables"
  | "unsupported";

export type FidelityEngine =
  | "layout"
  | "stroke"
  | "text"
  | "effects"
  | "masks"
  | "gradients"
  | "constraints"
  | "components"
  | "variables"
  | "import";

export interface FigmaComparableSnapshot {
  figKey?: string;
  figType?: string;
  nodeType: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  flipHorizontal?: boolean;
  flipVertical?: boolean;
  opacity?: number;
  visible?: boolean;
  fill?: string;
  fillOpacity?: number;
  fillEnabled?: boolean;
  fillType?: string;
  fillGradient?: string;
  fillTokenId?: string;
  strokeColor?: string;
  strokeWidth?: number;
  strokeOpacity?: number;
  strokeEnabled?: boolean;
  cornerRadius?: number;
  cornerRadii?: number[];
  effects?: string;
  blendMode?: string;
  content?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  lineHeight?: number;
  letterSpacing?: number;
  textAlign?: string;
  verticalAlign?: string;
  textStyleTokenId?: string;
  layoutMode?: string;
  layoutGap?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  primaryAxisAlign?: string;
  counterAxisAlign?: string;
  layoutSizingHorizontal?: string;
  layoutSizingVertical?: string;
  layoutPositioning?: string;
  layoutWrap?: boolean;
  layoutGrow?: number;
  constraintsHorizontal?: string;
  constraintsVertical?: string;
  isComponent?: boolean;
  componentId?: string;
  sourceComponentId?: string;
  clipChildren?: boolean;
  isMask?: boolean;
  booleanOperation?: string;
  unsupported?: string[];
}

export interface FidelityMismatch {
  category: FidelityCategory;
  field: string;
  figmaValue: string | number | boolean | null;
  canvasValue: string | number | boolean | null;
  delta?: string;
  impact: number;
  engine: FidelityEngine;
  message: string;
}

export interface NodeFidelityReport {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  fidelityScore: number;
  mismatches: FidelityMismatch[];
  figBounds: { x: number; y: number; width: number; height: number };
  canvasBounds: { x: number; y: number; width: number; height: number };
  positionDelta: { dx: number; dy: number };
  sizeDelta: { dw: number; dh: number };
}

export interface FigmaFidelityProjectReport {
  totalNodes: number;
  matchedNodes: number;
  mismatchedNodes: number;
  unsupportedFeatures: string[];
  fidelityScore: number;
  nodes: NodeFidelityReport[];
  engineBreakdown: Record<FidelityEngine, number>;
}

export interface FigImportFidelityCapture {
  figma: FigmaComparableSnapshot;
  importedAt?: string;
}
