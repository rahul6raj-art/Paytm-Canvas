"use client";

import { useMemo } from "react";
import { useEditorStore } from "@/stores/useEditorStore";
import type { DesignToken } from "@/lib/designTokens";
import { isTypographyValue } from "@/lib/designTokens";

export function getTypographyDesignTokens(tokens: Record<string, DesignToken>): DesignToken[] {
  return Object.values(tokens)
    .filter((t) => t.type === "typography" && isTypographyValue(t.value))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function typographyTokenSummary(token: DesignToken): string {
  if (token.type !== "typography" || !isTypographyValue(token.value)) return "";
  const v = token.value;
  return `${v.fontSize}px · ${v.fontWeight}`;
}
