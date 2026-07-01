import { CODE_PAYLOAD_START } from "@/lib/codeRoundTrip/types";
import type { CodeRoundTripLink } from "@/lib/craftBridge/types";

/** True when the linked file is a real app screen (PML/components), not a Craft-only export. */
export function looksLikeLinkedAppScreenSource(sourceContent: string): boolean {
  if (/<(Header|SectionHeader|ListItem|TextField|Card|BottomNav|Button)\b/.test(sourceContent)) {
    return true;
  }
  if (/from\s+["']@\/components\//.test(sourceContent)) return true;
  if (/from\s+["']@\/screens\//.test(sourceContent)) return true;
  if (/className=["'][^"']*pml-/.test(sourceContent)) return true;
  return false;
}

/** Craft portable export (div tree) — safe to replace wholesale; not a linked app screen. */
export function isCraftOnlyPortableExport(sourceContent: string): boolean {
  return (
    sourceContent.includes("Paytm Craft — Design ↔ Code export") &&
    !looksLikeLinkedAppScreenSource(sourceContent)
  );
}

function isBridgeManagedAppSourcePath(sourcePath: string): boolean {
  const norm = sourcePath.replace(/\\/g, "/");
  return /\/src\/(screens|features|pages|components)\/.+\.(tsx|jsx)$/.test(norm);
}

/** Source was replaced by Craft portable div export — real components (Header, SVG) are gone. */
export function isCorruptedCraftDivExport(sourceContent: string): boolean {
  if (sourceContent.includes("Paytm Craft — Design ↔ Code export")) {
    return !/<(Header|SectionHeader|ListItem|Card|BottomNav)\b/.test(sourceContent);
  }
  if (/data-pc-type=["']frame["']/.test(sourceContent)) {
    return !/<(Header|SectionHeader|ListItem|Card|BottomNav)\b/.test(sourceContent);
  }
  return false;
}

/** App screen file still has real React components — safe to patch additions into. */
export function looksLikeHealthyAppScreenSource(sourceContent: string): boolean {
  if (isCorruptedCraftDivExport(sourceContent)) return false;
  return looksLikeLinkedAppScreenSource(sourceContent);
}

function looksLikeGenericReactScreen(sourceContent: string): boolean {
  if (!/export\s+(?:default\s+)?(?:function|const)\s+\w+/m.test(sourceContent)) return false;
  if (!/from\s+["']react["']/.test(sourceContent)) return false;
  return /return\s*\(\s*</m.test(sourceContent) || /return\s+</m.test(sourceContent);
}

/** Live preview links patch the real screen file instead of replacing it with Craft export output. */
export function shouldUseSemanticBridgeSync(
  link: CodeRoundTripLink,
  sourceContent: string,
): boolean {
  if (!link.previewUrl?.trim()) return false;
  if (isCraftOnlyPortableExport(sourceContent)) return false;
  if (looksLikeLinkedAppScreenSource(sourceContent)) return true;
  if (looksLikeGenericReactScreen(sourceContent)) return true;
  if (/@craft-canvas-additions:start/.test(sourceContent)) return true;
  if (isBridgeManagedAppSourcePath(link.sourcePath)) return true;
  return !sourceContent.includes(CODE_PAYLOAD_START);
}
