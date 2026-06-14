import {
  designTokenTimestamp,
  newDesignTokenId,
  type DesignToken,
} from "@/lib/designTokens";
import { figmaColorToHex } from "@/lib/figImport/figmaGradientPaint";
import type { FigmaApiNode } from "@/integrations/figma/types";

export type FigmaVariable = {
  name?: string;
  resolvedType?: string;
  valuesByMode?: Record<string, FigmaVariableValue>;
};

export type FigmaVariableValue = {
  r?: number;
  g?: number;
  b?: number;
  a?: number;
  type?: string;
  value?: number;
};

export type FigmaVariablesMeta = {
  variables?: Record<string, FigmaVariable>;
};

export type FigmaImportTokenBundle = {
  designTokens: Record<string, DesignToken>;
  variableIdToTokenId: Map<string, string>;
};

function firstModeValue(variable: FigmaVariable): FigmaVariableValue | undefined {
  const modes = variable.valuesByMode;
  if (!modes) return undefined;
  const first = Object.values(modes)[0];
  return first;
}

export function designTokensFromFigmaVariables(
  meta: FigmaVariablesMeta | null | undefined,
): FigmaImportTokenBundle {
  const designTokens: Record<string, DesignToken> = {};
  const variableIdToTokenId = new Map<string, string>();
  if (!meta?.variables) {
    return { designTokens, variableIdToTokenId };
  }

  const now = designTokenTimestamp();

  for (const [variableId, variable] of Object.entries(meta.variables)) {
    const name = (variable.name ?? "").trim() || variableId;
    const value = firstModeValue(variable);
    if (!value) continue;

    const resolved = (variable.resolvedType ?? "").toUpperCase();

    if (resolved === "COLOR") {
      if (value.r == null || value.g == null || value.b == null) continue;
      const id = newDesignTokenId("figma-color");
      designTokens[id] = {
        id,
        name,
        type: "color",
        value: { hex: figmaColorToHex(value as { r: number; g: number; b: number; a?: number }), opacity: value.a ?? 1 },
        createdAt: now,
        updatedAt: now,
      };
      variableIdToTokenId.set(variableId, id);
      continue;
    }

    if (resolved === "FLOAT") {
      const num = value.value;
      if (num == null || !Number.isFinite(num)) continue;
      const id = newDesignTokenId("figma-spacing");
      designTokens[id] = {
        id,
        name,
        type: "spacing",
        value: { value: num },
        createdAt: now,
        updatedAt: now,
      };
      variableIdToTokenId.set(variableId, id);
    }
  }

  return { designTokens, variableIdToTokenId };
}

export function fillTokenIdFromBoundVariables(
  node: FigmaApiNode,
  variableIdToTokenId: Map<string, string>,
): string | undefined {
  const bound = node.boundVariables;
  if (!bound) return undefined;

  const fillBindings = bound.fills;
  if (Array.isArray(fillBindings)) {
    for (const entry of fillBindings) {
      const id = typeof entry === "string" ? entry : entry?.id;
      if (id && variableIdToTokenId.has(id)) return variableIdToTokenId.get(id);
    }
  }

  return undefined;
}
