"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SlidersHorizontal, X } from "lucide-react";
import { PropertiesSection } from "../PropertiesSection";
import { FontFamilyPicker } from "../FontFamilyPicker";
import { FontSizeInput } from "./FontSizeInput";
import {
  TypographyAlignmentFields,
  TypographyLineSpacingFields,
} from "./TypographySpacingAlignment";
import { TypographyMoreSettingsPanel } from "./TypographyMoreSettingsPanel";
import { TypographyLibraryDialog } from "../TypographyLibraryDialog";
import { EditorHintWrap } from "../EditorHoverHint";
import { InspectorHintIconButton } from "./InspectorPrimitives";
import { getTypographyDesignTokens } from "../LibraryTypographyPickerMenu";
import { handlePanelFieldKeyDown } from "@/lib/panelFieldKeyboard";
import { appFieldClass, appFieldRadius, inspectorControlHeightClass } from "@/lib/appFieldStyles";
import { cn } from "@/lib/utils";
import { inspectorIconClass, inspectorIconStroke } from "@/lib/inspectorIconStyles";
import {
  adjacentPanelDialogStyle,
  useAdjacentPanelDialogPosition,
} from "../useAdjacentPanelDialogPosition";
import { useDismissAnchoredDropdown } from "../useAnchoredDropdown";
import { useDraggableFloatingPanel } from "../useDraggableFloatingPanel";
import { useEditorStore } from "@/stores/useEditorStore";
import { DEFAULT_TEXT_FONT_SIZE, TEXT_FONT_WEIGHTS } from "@/lib/textTypography";
import {
  isTypographyValue,
  type DesignToken,
  type TypographyTokenValue,
} from "@/lib/designTokens";
import type { EditorNode, NodeStylePatch } from "@/stores/useEditorStore";

const field = appFieldClass;

export function TypographySection({
  node,
  display,
  instanceKey,
  locked,
  textContentDraft,
  onTextContentDraftChange,
  onTextContentCommit,
  designTokens,
  onStyle,
  onUpdateDesignToken,
  onCreateTypographyToken,
  onCreateColorToken,
  onDetachTypographyToken,
  onDetachColorToken,
}: {
  node: EditorNode;
  display: EditorNode;
  instanceKey: string;
  locked: boolean;
  textContentDraft: string;
  onTextContentDraftChange: (value: string) => void;
  onTextContentCommit: () => void;
  designTokens: Record<string, DesignToken>;
  onStyle: (p: NodeStylePatch) => void;
  onUpdateDesignToken: (tokenId: string, patch: Partial<DesignToken>) => void;
  onCreateTypographyToken: () => void;
  onCreateColorToken: () => void;
  onDetachTypographyToken: () => void;
  onDetachColorToken: () => void;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [typoLibraryOpen, setTypoLibraryOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const moreRef = useRef<HTMLButtonElement>(null);
  const typoLibraryAnchorRef = useRef<HTMLButtonElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const applyTokenToSelection = useEditorStore((s) => s.applyTokenToSelection);
  const basePosition = useAdjacentPanelDialogPosition(moreRef, moreOpen, {
    width: 260,
    maxHeight: 520,
    remeasureKey: instanceKey,
  });
  const { position: dragPosition, onHeaderPointerDown, isDragging } = useDraggableFloatingPanel(
    moreOpen,
    basePosition,
  );
  useDismissAnchoredDropdown(moreOpen, () => setMoreOpen(false), moreRef, moreMenuRef);

  useEffect(() => setMounted(true), []);
  useEffect(() => setMoreOpen(false), [instanceKey]);
  useEffect(() => setTypoLibraryOpen(false), [instanceKey]);

  const typoToken = node.textStyleTokenId ? designTokens[node.textStyleTokenId] : undefined;
  const typoLibraryCount = useMemo(
    () => getTypographyDesignTokens(designTokens).length,
    [designTokens],
  );
  const canPickTypoLibrary = typoLibraryCount > 0 && !locked;
  const typoLibraryTitle = typoToken?.name ?? "Text styles";

  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setMoreOpen(false);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [moreOpen]);

  const patchTypography = (patch: Partial<TypographyTokenValue>) => {
    if (!node.textStyleTokenId) return false;
    const t = designTokens[node.textStyleTokenId];
    if (t?.type !== "typography" || !isTypographyValue(t.value)) return false;
    onUpdateDesignToken(node.textStyleTokenId, {
      value: { ...(t.value as TypographyTokenValue), ...patch },
    });
    return true;
  };

  const moreDialog =
    moreOpen && mounted ? (
      <div
        ref={moreMenuRef}
        role="dialog"
        aria-label="Typography settings"
        aria-modal="false"
        data-editor-shell
        className="editor-inspector-dialog fixed z-[120]"
        style={adjacentPanelDialogStyle(dragPosition)}
      >
        <div
          className={cn("editor-inspector-dialog-header", isDragging && "cursor-grabbing")}
          onPointerDown={onHeaderPointerDown}
        >
          <div className="inspector-field-label pointer-events-none">Typography settings</div>
          <button
            type="button"
            onClick={() => setMoreOpen(false)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-app-muted transition-colors hover:bg-app-hover hover:text-app-fg"
            aria-label="Close typography settings"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </div>
        <div className="editor-inspector-dialog-body overscroll-contain">
          <TypographyMoreSettingsPanel
            node={node}
            instanceKey={instanceKey}
            locked={locked}
            designTokens={designTokens}
            onStyle={onStyle}
            onCreateTypographyToken={onCreateTypographyToken}
            onCreateColorToken={onCreateColorToken}
            onDetachTypographyToken={onDetachTypographyToken}
            onDetachColorToken={onDetachColorToken}
          />
        </div>
      </div>
    ) : null;

  return (
    <>
      <PropertiesSection
        title="Typography"
        headerActions={
          <InspectorHintIconButton
            title="More typography settings"
            disabled={locked}
            buttonRef={moreRef}
            pressed={moreOpen}
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((o) => !o)}
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded border border-app-border bg-app-panel text-app-muted transition-colors hover:bg-app-hover hover:text-app-fg disabled:opacity-40",
              moreOpen && "border-app-panel-edge bg-app-inset text-app-fg",
            )}
          >
            <SlidersHorizontal className={inspectorIconClass} strokeWidth={inspectorIconStroke} />
          </InspectorHintIconButton>
        }
      >
        <textarea
          disabled={locked}
          className={cn(
            "min-h-[56px] w-full resize-y border border-app-border bg-app-inset p-1.5 text-ui leading-snug text-app-field-fg focus-visible:border-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:opacity-45",
            appFieldRadius,
          )}
          value={textContentDraft}
          onChange={(e) => onTextContentDraftChange(e.target.value)}
          onKeyDown={(e) => handlePanelFieldKeyDown(e)}
          onBlur={onTextContentCommit}
        />

        {canPickTypoLibrary ? (
          <div className="mb-2 flex flex-wrap items-center gap-1">
            <EditorHintWrap
              title={
                typoToken
                  ? `${typoToken.name} — change text style`
                  : "Choose text style from library"
              }
              disabled={locked}
            >
              <button
                ref={typoLibraryAnchorRef}
                type="button"
                disabled={locked}
                onClick={() => setTypoLibraryOpen((o) => !o)}
                className={cn(
                  "flex min-h-[28px] min-w-0 flex-1 items-center truncate rounded border border-app-border bg-app-surface px-2 text-left text-ui font-medium text-app-fg hover:bg-app-hover",
                  inspectorControlHeightClass,
                  typoLibraryOpen && "border-app-panel-edge bg-app-inset ring-1 ring-app-panel-edge",
                )}
                aria-expanded={typoLibraryOpen}
                aria-haspopup="dialog"
              >
                {typoToken?.name ?? "Choose text style"}
              </button>
            </EditorHintWrap>
            {node.textStyleTokenId ? (
              <button
                type="button"
                disabled={locked}
                onClick={onDetachTypographyToken}
                className="rounded border border-app-border bg-app-panel px-2 py-0.5 text-ui font-medium text-app-fg hover:bg-app-hover disabled:opacity-40"
              >
                Detach
              </button>
            ) : null}
          </div>
        ) : null}

        <FontFamilyPicker
          value={display.fontFamily ?? "var(--font-inter), Inter, system-ui, sans-serif"}
          disabled={locked}
          onChange={(v) => {
            if (patchTypography({ fontFamily: v })) return;
            onStyle({ fontFamily: v });
          }}
          className="w-full"
          buttonClassName="w-full"
        />

        <div className="grid grid-cols-2 gap-x-2">
          <div>
            <div className="inspector-field-label">Weight</div>
            <select
              aria-label="Font weight"
              disabled={locked}
              className={cn(field, "w-full cursor-pointer")}
              value={display.fontWeight ?? 500}
              onChange={(e) => {
                const w = Number(e.target.value);
                if (patchTypography({ fontWeight: w })) return;
                onStyle({ fontWeight: w });
              }}
            >
              {!TEXT_FONT_WEIGHTS.some((opt) => opt.value === (display.fontWeight ?? 500)) ? (
                <option value={display.fontWeight ?? 500}>{display.fontWeight ?? 500}</option>
              ) : null}
              {TEXT_FONT_WEIGHTS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <FontSizeInput
            value={display.fontSize ?? DEFAULT_TEXT_FONT_SIZE}
            instanceKey={instanceKey}
            disabled={locked}
            onCommit={(v) => {
              if (patchTypography({ fontSize: v })) return;
              onStyle({ fontSize: v });
            }}
          />
        </div>

        <TypographyLineSpacingFields
          display={display}
          instanceKey={instanceKey}
          locked={locked}
          onCommitLineHeight={(v) => {
            if (patchTypography({ lineHeight: v })) return;
            onStyle({ lineHeight: v });
          }}
          onCommitLetterSpacing={(v) => {
            if (patchTypography({ letterSpacing: v })) return;
            onStyle({ letterSpacing: v });
          }}
        />

        <TypographyAlignmentFields node={node} locked={locked} onStyle={onStyle} />
      </PropertiesSection>

      {mounted && moreDialog ? createPortal(moreDialog, document.body) : null}
      {canPickTypoLibrary ? (
        <TypographyLibraryDialog
          open={typoLibraryOpen}
          onClose={() => setTypoLibraryOpen(false)}
          anchorRef={typoLibraryAnchorRef}
          title={typoLibraryTitle}
          activeTokenId={node.textStyleTokenId}
          onPick={(tokenId) => {
            applyTokenToSelection(tokenId);
            setTypoLibraryOpen(false);
          }}
        />
      ) : null}
    </>
  );
}
