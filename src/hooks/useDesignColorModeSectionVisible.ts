import { useEditorStore } from "@/stores/useEditorStore";
import type { CodeRoundTripLink } from "@/lib/craftBridge/types";
import { designTokensHaveDarkColorModes, type DesignToken } from "@/lib/designTokens";

export function isDesignColorModeSectionVisible(
  codeRoundTripLink: CodeRoundTripLink | null,
  designTokens: Record<string, DesignToken>,
): boolean {
  const hasLinkedSource = Boolean(
    codeRoundTripLink?.sourcePath?.trim() || codeRoundTripLink?.repoRoot?.trim(),
  );
  return hasLinkedSource || designTokensHaveDarkColorModes(designTokens);
}

export function useDesignColorModeSectionVisible(): boolean {
  const codeRoundTripLink = useEditorStore((s) => s.codeRoundTripLink);
  const designTokens = useEditorStore((s) => s.designTokens);
  return isDesignColorModeSectionVisible(codeRoundTripLink, designTokens);
}
