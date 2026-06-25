import type { CrossAxisAlign, LayoutMode, PrimaryAxisAlign } from "@/lib/autoLayout";
import type { EditorNode } from "@/stores/useEditorStore";

/** Map common utility class tokens → editor layout/style (Tailwind-like). */
export function classNameToNodePatch(className: string | undefined): Partial<EditorNode> {
  if (!className?.trim()) return {};
  const patch: Partial<EditorNode> = {};
  const tokens = className.split(/\s+/).filter(Boolean);

  if (className.includes("pml-home") && !className.includes("__")) {
    patch.width = 390;
    patch.height = 844;
    patch.layoutMode = "vertical" as LayoutMode;
    patch.layoutGap = 0;
    patch.fill = "#0f1117";
    patch.fillEnabled = true;
  }

  if (className.includes("pml-signup") && !className.includes("__")) {
    patch.width = 390;
    patch.height = 844;
    patch.layoutMode = "vertical" as LayoutMode;
    patch.layoutGap = 0;
    patch.fill = "#0f1117";
    patch.fillEnabled = true;
  }

  if (className.includes("pml-more") && !className.includes("__")) {
    patch.width = 390;
    patch.height = 844;
    patch.layoutMode = "vertical" as LayoutMode;
    patch.layoutGap = 0;
    patch.fill = "#0f1117";
    patch.fillEnabled = true;
  }

  for (const t of tokens) {
    if (t === "pml-home__scroll" || t === "pml-home-scroll" || t === "pml-signup__scroll" || t === "pml-more__scroll") {
      patch.layoutMode = "vertical" as LayoutMode;
      patch.layoutGap = patch.layoutGap ?? 0;
      patch.height = patch.height ?? 640;
      patch.width = patch.width ?? 390;
      patch.layoutSizingVertical = "fill";
    }
    if (t === "pml-signup__main") {
      patch.layoutMode = "vertical" as LayoutMode;
      patch.layoutGap = 0;
      patch.width = patch.width ?? 390;
      patch.layoutSizingVertical = "fill";
    }
    if (t === "pml-signup__body" || t === "pml-signup__hero" || t === "pml-signup__footer-zone") {
      patch.layoutMode = "vertical" as LayoutMode;
      patch.width = patch.width ?? 390;
    }
    if (t === "pml-signup__hero") {
      patch.layoutGap = 8;
    }
    if (t === "pml-signup__tc") {
      patch.layoutMode = "horizontal";
      patch.layoutGap = 8;
      patch.counterAxisAlign = "start";
    }
    if (t === "pml-signup__tc-text") {
      patch.layoutSizingHorizontal = "fill";
    }
    if (t === "pml-signup__footer" || t === "pml-signup__form") {
      patch.layoutMode = "vertical" as LayoutMode;
      patch.width = patch.width ?? 390;
      patch.layoutGap = patch.layoutGap ?? 12;
    }
    if (t.startsWith("pml-home__") || t.startsWith("pml-signup__") || t.startsWith("pml-more__") || t.startsWith("sh-section")) {
      patch.width = patch.width ?? 390;
    }
    if (t === "bn" || t === "bn__tabs") {
      patch.layoutMode = "horizontal";
      patch.width = patch.width ?? 390;
      patch.layoutGap = patch.layoutGap ?? 0;
      patch.counterAxisAlign = "stretch";
    }
    if (t === "bn__tab") {
      patch.layoutMode = "vertical";
      patch.layoutSizingHorizontal = "fill";
      patch.counterAxisAlign = "center";
      patch.primaryAxisAlign = "center";
      patch.width = patch.width ?? 78;
    }
    if (t === "bn__label") {
      patch.textAlign = "center";
      patch.textResizeMode = "auto-width";
      patch.width = Math.max(patch.width ?? 0, 56);
      patch.height = Math.max(patch.height ?? 0, 16);
    }
    if (t === "flex" || t === "inline-flex") {
      patch.layoutMode = patch.layoutMode ?? "horizontal";
    } else if (t === "flex-col" || t === "flex-column") {
      patch.layoutMode = "vertical";
    } else if (t === "flex-row") {
      patch.layoutMode = "horizontal";
    } else if (t === "items-center") {
      patch.counterAxisAlign = "center" as CrossAxisAlign;
    } else if (t === "items-end") {
      patch.counterAxisAlign = "end" as CrossAxisAlign;
    } else if (t === "items-stretch") {
      patch.counterAxisAlign = "stretch" as CrossAxisAlign;
    } else if (t === "justify-center") {
      patch.primaryAxisAlign = "center" as PrimaryAxisAlign;
    } else if (t === "justify-end") {
      patch.primaryAxisAlign = "end" as PrimaryAxisAlign;
    } else if (t === "justify-between") {
      patch.primaryAxisAlign = "space-between" as PrimaryAxisAlign;
    }

    const gapPx = t.match(/^gap-(?:\[(\d+)px\]|(\d+))$/);
    if (gapPx) {
      const n = gapPx[1] ? parseInt(gapPx[1], 10) : tailwindSpacing(gapPx[2]!);
      if (Number.isFinite(n)) patch.layoutGap = n;
    }

    const wPx = t.match(/^w-(?:\[(\d+)px\]|full|screen)$/);
    if (wPx) {
      if (wPx[1]) patch.width = parseInt(wPx[1], 10);
      else if (t === "w-full" || t === "w-screen") patch.width = 390;
    }

    const hPx = t.match(/^h-(?:\[(\d+)px\]|full|screen)$/);
    if (hPx) {
      if (hPx[1]) patch.height = parseInt(hPx[1], 10);
      else if (t === "h-full" || t === "h-screen") patch.height = 844;
    }

    const minHPx = t.match(/^min-h-(?:\[(\d+)px\]|screen)$/);
    if (minHPx) {
      if (minHPx[1]) patch.height = parseInt(minHPx[1], 10);
      else if (t === "min-h-screen") patch.height = 844;
    }

    const pPx = t.match(/^p-(?:\[(\d+)px\]|(\d+))$/);
    if (pPx) {
      const n = pPx[1] ? parseInt(pPx[1], 10) : tailwindSpacing(pPx[2]!);
      if (Number.isFinite(n)) {
        patch.paddingTop = n;
        patch.paddingRight = n;
        patch.paddingBottom = n;
        patch.paddingLeft = n;
      }
    }

    const pxPx = t.match(/^px-(?:\[(\d+)px\]|(\d+))$/);
    if (pxPx) {
      const n = pxPx[1] ? parseInt(pxPx[1], 10) : tailwindSpacing(pxPx[2]!);
      if (Number.isFinite(n)) {
        patch.paddingLeft = n;
        patch.paddingRight = n;
      }
    }

    const pyPx = t.match(/^py-(?:\[(\d+)px\]|(\d+))$/);
    if (pyPx) {
      const n = pyPx[1] ? parseInt(pyPx[1], 10) : tailwindSpacing(pyPx[2]!);
      if (Number.isFinite(n)) {
        patch.paddingTop = n;
        patch.paddingBottom = n;
      }
    }

    if (t.startsWith("rounded")) {
      const roundedPx = t.match(/^rounded-\[(\d+)px\]$/);
      if (roundedPx) patch.cornerRadius = parseInt(roundedPx[1]!, 10);
      else if (t === "rounded-full") patch.cornerRadius = 9999;
      else if (t === "rounded-2xl") patch.cornerRadius = 16;
      else if (t === "rounded-xl") patch.cornerRadius = 12;
      else if (t === "rounded-lg") patch.cornerRadius = 12;
      else patch.cornerRadius = 8;
    }

    const bgHex = t.match(/^bg-\[(#[0-9a-fA-F]{3,8})\]$/);
    if (bgHex) {
      patch.fill = bgHex[1];
      patch.fillEnabled = true;
    }

    const textHex = t.match(/^text-\[(#[0-9a-fA-F]{3,8})\]$/);
    if (textHex) {
      patch.textColor = textHex[1];
      patch.fill = textHex[1];
    }

    const borderHex = t.match(/^border-\[(#[0-9a-fA-F]{3,8})\]$/);
    if (borderHex) {
      patch.strokeColor = borderHex[1];
      patch.strokeWidth = patch.strokeWidth ?? 1;
    }

    const maxWPx = t.match(/^max-w-\[(\d+)px\]$/);
    if (maxWPx) patch.width = parseInt(maxWPx[1]!, 10);

    const minHBracket = t.match(/^min-h-\[(\d+)px\]$/);
    if (minHBracket) patch.height = Math.max(patch.height ?? 0, parseInt(minHBracket[1]!, 10));

    const minWPx = t.match(/^min-w-\[(\d+)px\]$/);
    if (minWPx) patch.width = Math.max(patch.width ?? 0, parseInt(minWPx[1]!, 10));

    if (t === "flex-1") {
      patch.layoutSizingVertical = "fill";
    }

    if (t === "shrink-0") {
      patch.layoutSizingHorizontal = "fixed";
      patch.layoutSizingVertical = "fixed";
    }

    if (t === "grid") {
      patch.layoutMode = "horizontal";
      patch.layoutWrap = true;
    }

    const gridCols = t.match(/^grid-cols-(\d+)$/);
    if (gridCols) {
      patch.layoutMode = "horizontal";
      patch.layoutWrap = true;
    }

    if (t === "overflow-hidden" || t === "overflow-y-auto") {
      patch.clipChildren = true;
    }

    if (t === "relative" || t === "absolute" || t === "fixed") {
      patch.x = patch.x ?? 0;
      patch.y = patch.y ?? 0;
    }
  }

  return patch;
}

function tailwindSpacing(token: string): number {
  const n = parseInt(token, 10);
  if (!Number.isFinite(n)) return 0;
  return n * 4;
}

export function mergeStylePatches(
  ...patches: Partial<EditorNode>[]
): Partial<EditorNode> {
  const out: Partial<EditorNode> = {};
  for (const p of patches) {
    Object.assign(out, p);
  }
  return out;
}
