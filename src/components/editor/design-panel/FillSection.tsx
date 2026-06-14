"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { Eye, EyeOff, Minus } from "lucide-react";
import { PropertiesSection } from "../PropertiesSection";
import { ColorInput } from "../ColorInput";
import { ColorLibrary } from "../ColorLibrary";
import {
  inspectorIconClass,
  inspectorIconStroke,
  inspectorLucideProps,
  inspectorRowActionBtnClass,
} from "@/lib/inspectorIconStyles";
import { cn } from "@/lib/utils";
import { appFieldRadius, inspectorControlHeightClass } from "@/lib/appFieldStyles";
import { handlePanelFieldKeyDown, keyboardNudgeStep } from "@/lib/panelFieldKeyboard";
import { useInspectorValueScrub } from "@/lib/useInspectorValueScrub";
import { isColorValue, type ColorTokenValue, type DesignToken } from "@/lib/designTokens";
import { useEditorStore, type EditorNode, type NodeStylePatch } from "@/stores/useEditorStore";
import { DEFAULT_FRAME_FILL, DEFAULT_SHAPE_FILL } from "@/lib/shapes/shapeModel";
import { resolveNodeFillGradientForEdit } from "@/lib/designTokens";
import {
  defaultFillGradient,
  effectiveFillType,
  gradientInspectorBarPaintCss,
  normalizeFillGradient,
  type FillGradient,
} from "@/lib/fillGradient";
import type { FillType } from "@/lib/gradient/types";
import { mediaFillPreviewCss } from "@/lib/gradient/mediaFill";
import { InspectorSegmented } from "./InspectorPrimitives";
import { GradientFillEditorDialog } from "../gradient/GradientFillEditorDialog";
import { FillAssetPickerAside } from "../FillAssetPickerAside";
import {
  clearGradientEditorFocusIfConsumed,
  getGradientEditorFocusSnapshot,
  subscribeGradientEditorFocus,
  type GradientEditorFocusRequest,
} from "@/lib/gradientEditorFocus";
import {
  setGradientEditorVisible,
} from "@/lib/gradientEditorVisibility";

function commitFillOpacity(
  op: number,
  node: EditorNode,
  designTokens: Record<string, DesignToken>,
  onStyle: (p: NodeStylePatch) => void,
  onUpdateDesignToken: (tokenId: string, patch: Partial<DesignToken>) => void,
) {
  if (node.fillTokenId) {
    const t = designTokens[node.fillTokenId];
    if (t?.type === "color" && isColorValue(t.value)) {
      onUpdateDesignToken(node.fillTokenId, {
        value: { ...(t.value as ColorTokenValue), opacity: op },
      });
      return;
    }
  }
  onStyle({ fillOpacity: op });
}

export function GradientFillInspectorRow({
  gradient,
  fillOpacity,
  kindLabel,
  visible,
  disabled,
  locked,
  editorOpen,
  instanceKey,
  anchorRef,
  onOpenEditor,
  onToggleVisible,
  onRemove,
  onCommitOpacity,
}: {
  gradient: FillGradient;
  fillOpacity: number;
  kindLabel: string;
  visible: boolean;
  disabled: boolean;
  locked: boolean;
  editorOpen: boolean;
  instanceKey: string;
  anchorRef: RefObject<HTMLButtonElement | null>;
  onOpenEditor: () => void;
  onToggleVisible: () => void;
  onRemove: () => void;
  onCommitOpacity: (op: number) => void;
}) {
  const percent = Math.round(Math.min(1, Math.max(0, fillOpacity)) * 100);
  const [opacityFocused, setOpacityFocused] = useState(false);
  const [opacityText, setOpacityText] = useState(() => String(percent));

  const commitPercent = (n: number) => {
    const clamped = Math.min(100, Math.max(0, Math.round(n)));
    onCommitOpacity(clamped / 100);
    setOpacityText(String(clamped));
  };

  const {
    scrubbing: opacityScrubbing,
    scrubActiveRef: opacityScrubActiveRef,
    bindScrubInput: bindOpacityScrub,
  } = useInspectorValueScrub({
    disabled: disabled || !visible,
    value: percent,
    min: 0,
    max: 100,
    onChange: commitPercent,
  });

  useEffect(() => {
    if (opacityFocused || opacityScrubbing || opacityScrubActiveRef.current) return;
    setOpacityText(String(Math.round(Math.min(1, Math.max(0, fillOpacity)) * 100)));
  }, [fillOpacity, instanceKey, opacityFocused, opacityScrubbing, opacityScrubActiveRef]);

  const applyDraft = (raw: string) => {
    const digits = raw.replace(/%/g, "").trim();
    if (digits === "") return false;
    const n = parseInt(digits, 10);
    if (!Number.isFinite(n)) return false;
    commitPercent(n);
    return true;
  };

  const rowDisabled = disabled || !visible;

  return (
    <div className="flex items-center gap-1">
      <div
        className={cn(
          "flex min-w-0 flex-1 items-center overflow-hidden border border-app-border bg-app-field",
          inspectorControlHeightClass,
          appFieldRadius,
          rowDisabled && "opacity-45",
          (editorOpen || opacityFocused) && "border-accent ring-1 ring-accent",
        )}
      >
        <button
          ref={anchorRef}
          type="button"
          disabled={rowDisabled}
          onClick={onOpenEditor}
          className={cn(
            "flex h-7 min-w-0 flex-1 items-center gap-1.5 border-0 bg-transparent px-1.5 text-left disabled:cursor-not-allowed",
            editorOpen && "bg-accent/10",
          )}
          aria-expanded={editorOpen}
          aria-haspopup="dialog"
          aria-label="Edit gradient fill"
        >
          <div
            className="h-4 w-4 shrink-0 rounded-sm border border-app-border shadow-inner"
            style={{ background: gradientInspectorBarPaintCss(gradient, fillOpacity) }}
            aria-hidden
          />
          <span className="truncate text-ui text-app-field-fg">{kindLabel}</span>
        </button>
        <div className="h-5 w-px shrink-0 bg-app-border" aria-hidden />
        <input
          type="text"
          inputMode="numeric"
          disabled={rowDisabled}
          aria-label="Opacity percent"
          {...bindOpacityScrub(
            "h-full w-9 shrink-0 border-0 bg-transparent px-1 py-0 text-right font-mono text-ui tabular-nums text-app-field-fg focus-visible:outline-none disabled:cursor-not-allowed",
            opacityFocused,
          )}
          value={opacityText}
          onFocus={() => setOpacityFocused(true)}
          onChange={(e) => {
            const digits = e.target.value.replace(/[^\d]/g, "").slice(0, 3);
            setOpacityText(digits);
            if (digits !== "") {
              const n = parseInt(digits, 10);
              if (Number.isFinite(n)) commitPercent(n);
            }
          }}
          onBlur={() => {
            if (opacityScrubActiveRef.current) return;
            setOpacityFocused(false);
            if (!applyDraft(opacityText)) setOpacityText(String(percent));
          }}
          onKeyDown={(e) => {
            handlePanelFieldKeyDown(e, {
              onEnter: () => {
                if (!applyDraft(opacityText)) setOpacityText(String(percent));
                e.currentTarget.blur();
              },
              onArrowNudge: (dir, shift, alt) => {
                const step = keyboardNudgeStep(1, 0, shift, alt) * dir;
                const current = parseInt(opacityText, 10);
                const base = Number.isFinite(current) ? current : percent;
                commitPercent(base + step);
              },
            });
          }}
        />
        <span className="shrink-0 pr-2 text-ui text-app-subtle">%</span>
      </div>
      <button
        type="button"
        disabled={locked}
        title={visible ? "Hide fill" : "Show fill"}
        onClick={onToggleVisible}
        className={cn(inspectorRowActionBtnClass, "inspector-icon-btn")}
      >
        {visible ? <Eye {...inspectorLucideProps()} /> : <EyeOff {...inspectorLucideProps()} />}
      </button>
      <button
        type="button"
        disabled={locked}
        onClick={onRemove}
        className={cn(inspectorRowActionBtnClass, "inspector-icon-btn hover:text-rose-300")}
        aria-label="Remove fill"
      >
        <Minus className={inspectorIconClass} strokeWidth={inspectorIconStroke} />
      </button>
    </div>
  );
}

export const FILL_TYPE_OPTIONS: { value: FillType; label: string }[] = [
  { value: "solid", label: "Solid" },
  { value: "gradient", label: "Gradient" },
  { value: "image", label: "Image" },
  { value: "video", label: "Video" },
];

export function mediaFillAssetField(
  kind: "image" | "video",
  assetId: string,
): NodeStylePatch {
  if (kind === "video") return { fillType: "video", fillVideoAssetId: assetId, fillEnabled: true };
  return { fillType: "image", fillImageAssetId: assetId, fillEnabled: true };
}

export function MediaFillInspectorRow({
  kind,
  assetId,
  assets,
  fillOpacity,
  visible,
  locked,
  instanceKey,
  pickerOpen,
  anchorRef,
  onTogglePicker,
  onClosePicker,
  onToggleVisible,
  onRemove,
  onCommitOpacity,
  onSelectAsset,
  previewNode,
}: {
  kind: "image" | "video";
  assetId?: string;
  assets: Record<string, import("@/lib/documentPersistence").EditorAsset>;
  fillOpacity: number;
  visible: boolean;
  locked: boolean;
  instanceKey: string;
  pickerOpen: boolean;
  anchorRef: RefObject<HTMLButtonElement | null>;
  onTogglePicker: () => void;
  onClosePicker: () => void;
  onToggleVisible: () => void;
  onRemove: () => void;
  onCommitOpacity: (op: number) => void;
  onSelectAsset: (id: string) => void;
  previewNode?: {
    fillType?: "image" | "video";
    fillImageAssetId?: string;
    fillVideoAssetId?: string;
    fillOpacity?: number;
    fillEnabled?: boolean;
  };
}) {
  const percent = Math.round(Math.min(1, Math.max(0, fillOpacity)) * 100);
  const [opacityFocused, setOpacityFocused] = useState(false);
  const [opacityText, setOpacityText] = useState(() => String(percent));

  const asset = assetId ? assets[assetId] : undefined;
  const kindLabel = kind === "image" ? "Image" : "Video";
  const resolvedPreview =
    previewNode ??
    ({
      fillType: kind,
      fillImageAssetId: kind === "image" ? assetId : undefined,
      fillVideoAssetId: kind === "video" ? assetId : undefined,
      fillOpacity,
      fillEnabled: true,
    } as const);
  const previewCss = mediaFillPreviewCss(resolvedPreview, assets);

  const commitPercent = (n: number) => {
    const clamped = Math.min(100, Math.max(0, Math.round(n)));
    onCommitOpacity(clamped / 100);
    setOpacityText(String(clamped));
  };

  const {
    scrubbing: opacityScrubbing,
    scrubActiveRef: opacityScrubActiveRef,
    bindScrubInput: bindOpacityScrub,
  } = useInspectorValueScrub({
    disabled: locked || !visible,
    value: percent,
    min: 0,
    max: 100,
    onChange: commitPercent,
  });

  useEffect(() => {
    if (opacityFocused || opacityScrubbing || opacityScrubActiveRef.current) return;
    setOpacityText(String(Math.round(Math.min(1, Math.max(0, fillOpacity)) * 100)));
  }, [fillOpacity, instanceKey, opacityFocused, opacityScrubbing, opacityScrubActiveRef]);

  const applyDraft = (raw: string) => {
    const digits = raw.replace(/%/g, "").trim();
    if (digits === "") return false;
    const n = parseInt(digits, 10);
    if (!Number.isFinite(n)) return false;
    commitPercent(n);
    return true;
  };

  const rowDisabled = locked || !visible;

  return (
    <>
      <div className="flex items-center gap-1">
        <div
          className={cn(
            "flex min-w-0 flex-1 items-center overflow-hidden border border-app-border bg-app-field",
          inspectorControlHeightClass,
            appFieldRadius,
            rowDisabled && "opacity-45",
            (pickerOpen || opacityFocused) && "border-accent ring-1 ring-accent",
          )}
        >
          <button
            ref={anchorRef}
            type="button"
            disabled={rowDisabled}
            onClick={onTogglePicker}
            className={cn(
              "flex h-7 min-w-0 flex-1 items-center gap-1.5 border-0 bg-transparent px-1.5 text-left disabled:cursor-not-allowed",
              pickerOpen && "bg-accent/10",
            )}
            aria-expanded={pickerOpen}
            aria-haspopup="dialog"
            aria-label={`Choose ${kindLabel.toLowerCase()} fill`}
          >
            <div
              className="h-4 w-4 shrink-0 rounded-sm border border-app-border shadow-inner"
              style={
                previewCss
                  ? { background: previewCss, backgroundColor: "#334155" }
                  : { background: "#334155" }
              }
              aria-hidden
            />
            <span className="truncate text-ui text-app-field-fg">
              {asset?.name ?? `Choose ${kindLabel.toLowerCase()}`}
            </span>
          </button>
          <div className="h-5 w-px shrink-0 bg-app-border" aria-hidden />
          <input
            type="text"
            inputMode="numeric"
            disabled={rowDisabled}
            aria-label="Opacity percent"
            {...bindOpacityScrub(
              "h-full w-9 shrink-0 border-0 bg-transparent px-1 py-0 text-right font-mono text-ui tabular-nums text-app-field-fg focus-visible:outline-none disabled:cursor-not-allowed",
              opacityFocused,
            )}
            value={opacityText}
            onFocus={() => setOpacityFocused(true)}
            onChange={(e) => {
              const digits = e.target.value.replace(/[^\d]/g, "").slice(0, 3);
              setOpacityText(digits);
              if (digits !== "") {
                const n = parseInt(digits, 10);
                if (Number.isFinite(n)) commitPercent(n);
              }
            }}
            onBlur={() => {
              if (opacityScrubActiveRef.current) return;
              setOpacityFocused(false);
              if (!applyDraft(opacityText)) setOpacityText(String(percent));
            }}
            onKeyDown={(e) => {
              handlePanelFieldKeyDown(e, {
                onEnter: () => {
                  if (!applyDraft(opacityText)) setOpacityText(String(percent));
                  e.currentTarget.blur();
                },
                onArrowNudge: (dir, shift, alt) => {
                  const step = keyboardNudgeStep(1, 0, shift, alt) * dir;
                  const current = parseInt(opacityText, 10);
                  const base = Number.isFinite(current) ? current : percent;
                  commitPercent(base + step);
                },
              });
            }}
          />
          <span className="shrink-0 pr-2 text-ui text-app-subtle">%</span>
        </div>
        <button
          type="button"
          disabled={locked}
          title={visible ? "Hide fill" : "Show fill"}
          onClick={onToggleVisible}
          className={cn(inspectorRowActionBtnClass, "inspector-icon-btn")}
        >
          {visible ? <Eye {...inspectorLucideProps()} /> : <EyeOff {...inspectorLucideProps()} />}
        </button>
        <button
          type="button"
          disabled={locked}
          onClick={onRemove}
          className={cn(inspectorRowActionBtnClass, "inspector-icon-btn hover:text-rose-300")}
          aria-label="Remove fill"
        >
          <Minus className={inspectorIconClass} strokeWidth={inspectorIconStroke} />
        </button>
      </div>
      <FillAssetPickerAside
        open={pickerOpen}
        onClose={onClosePicker}
        anchorRef={anchorRef}
        title={`${kindLabel} fill`}
        mode={kind}
        disabled={locked}
        onSelect={onSelectAsset}
      />
    </>
  );
}

export function FillSection({
  node,
  display,
  instanceKey,
  locked,
  fillEnabled,
  fillOpacity,
  fillToken,
  designTokens,
  onStyle,
  onDetachToken,
  onUpdateDesignToken,
}: {
  node: EditorNode;
  display: EditorNode;
  instanceKey: string;
  locked: boolean;
  fillEnabled: boolean;
  fillOpacity: number;
  fillToken: DesignToken | undefined;
  designTokens: Record<string, DesignToken>;
  onStyle: (p: NodeStylePatch, opts?: { skipHistory?: boolean }) => void;
  onDetachToken: (kind: "color" | "gradient") => void;
  onUpdateDesignToken: (tokenId: string, patch: Partial<DesignToken>) => void;
}) {
  const fillType = effectiveFillType(display);
  /** Pattern fills (SVG import) map to Image in the picker. */
  const fillTypeUi: FillType = fillType === "pattern" ? "image" : fillType;
  const mediaFillKind: "image" | "video" = fillType === "video" ? "video" : "image";
  const mediaFillAssetId =
    fillType === "video"
      ? display.fillVideoAssetId
      : display.fillImageAssetId ?? display.fillPatternAssetId;
  const defaultSolid = node.type === "frame" ? DEFAULT_FRAME_FILL : DEFAULT_SHAPE_FILL;
  const gradient = resolveNodeFillGradientForEdit(node, designTokens);
  const assets = useEditorStore((s) => s.assets);
  const [gradientEditorOpen, setGradientEditorOpen] = useState(false);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [editorFocus, setEditorFocus] = useState<Pick<
    GradientEditorFocusRequest,
    "stopId" | "openColorPicker" | "nonce"
  > | null>(null);
  const gradientAnchorRef = useRef<HTMLButtonElement>(null);
  const mediaAnchorRef = useRef<HTMLButtonElement>(null);
  const focusSnapshot = useSyncExternalStore(
    subscribeGradientEditorFocus,
    getGradientEditorFocusSnapshot,
    () => null,
  );

  useEffect(() => {
    setGradientEditorOpen(false);
    setEditorFocus(null);
  }, [instanceKey]);

  useEffect(() => {
    if (fillType !== "gradient") setGradientEditorOpen(false);
  }, [fillType]);

  useEffect(() => {
    if (gradientEditorOpen && fillType === "gradient") {
      setGradientEditorVisible(node.id);
    } else {
      setGradientEditorVisible(null);
    }
    return () => setGradientEditorVisible(null);
  }, [gradientEditorOpen, fillType, node.id]);

  useEffect(() => {
    if (!focusSnapshot || focusSnapshot.nodeId !== node.id) return;
    setGradientEditorOpen(true);
    setEditorFocus({
      stopId: focusSnapshot.stopId,
      openColorPicker: focusSnapshot.openColorPicker,
      nonce: focusSnapshot.nonce,
    });
    clearGradientEditorFocusIfConsumed(focusSnapshot.nonce);
  }, [focusSnapshot, node.id]);

  useEffect(() => {
    if (fillType === "solid" || fillType === "gradient") setMediaPickerOpen(false);
  }, [fillType, instanceKey]);

  const firstImageAsset = Object.values(assets).find((a) =>
    a.mimeType.toLowerCase().startsWith("image/"),
  );
  const firstVideoAsset = Object.values(assets).find((a) =>
    a.mimeType.toLowerCase().startsWith("video/"),
  );

  const setSolid = () => {
    onStyle({
      fillType: "solid",
      fill: display.fill ?? defaultSolid,
      fillGradient: undefined,
      fillEnabled: true,
    });
  };

  const setGradient = () => {
    const g = normalizeFillGradient(display.fillGradient, display.fill ?? defaultSolid);
    onStyle({
      fillType: "gradient",
      fillGradient: g.stops.length >= 2 ? g : defaultFillGradient(display.fill ?? defaultSolid),
      fillEnabled: true,
    });
    setGradientEditorOpen(true);
  };

  const setImageFill = () => {
    const assetId = display.fillImageAssetId ?? firstImageAsset?.id;
    onStyle({
      fillType: "image",
      fillImageAssetId: assetId,
      fillEnabled: true,
    });
    if (!assetId) setMediaPickerOpen(true);
  };

  const setVideoFill = () => {
    const assetId = display.fillVideoAssetId ?? firstVideoAsset?.id;
    onStyle({
      fillType: "video",
      fillVideoAssetId: assetId,
      fillEnabled: true,
    });
    if (!assetId) setMediaPickerOpen(true);
  };

  const onFillTypeChange = (v: FillType) => {
    if (v === "solid") setSolid();
    else if (v === "gradient") setGradient();
    else if (v === "image") setImageFill();
    else if (v === "video") setVideoFill();
  };

  const gradientKindLabel =
    gradient.kind.charAt(0).toUpperCase() + gradient.kind.slice(1);

  const toggleFillVisible = () => onStyle({ fillEnabled: !fillEnabled });

  const removeFill = () => onStyle({ fillEnabled: false });

  const handleCommitFillOpacity = (op: number) =>
    commitFillOpacity(op, node, designTokens, onStyle, onUpdateDesignToken);

  return (
    <PropertiesSection title="Fill" defaultOpen>
      <ColorLibrary variant="compact" className="mb-2" />
      {fillToken ? (
        <p className="mb-1.5 truncate text-ui text-app-muted">
          Style: <span className="font-medium text-app-fg">{fillToken.name}</span>
        </p>
      ) : null}
      {node.fillTokenId ? (
        <div className="mb-2 flex flex-wrap gap-1">
          <button
            type="button"
            disabled={locked}
            onClick={() => onDetachToken(fillToken?.type === "gradient" ? "gradient" : "color")}
            className="rounded border border-app-border bg-app-panel px-2 py-0.5 text-ui font-medium text-app-fg hover:bg-app-hover disabled:opacity-40"
          >
            Detach
          </button>
        </div>
      ) : null}

      <InspectorSegmented
        options={FILL_TYPE_OPTIONS}
        value={fillTypeUi}
        disabled={locked}
        scrollable
        onChange={onFillTypeChange}
      />

      <div className="mt-2">
        {fillType === "solid" ? (
          <ColorInput
            variant="inspectorRow"
            hex={display.fill ?? defaultSolid}
            opacity={fillOpacity}
            visible={fillEnabled}
            pickerTitle="Fill color"
            libraryName={fillToken?.name}
            libraryTokenId={node.fillTokenId}
            instanceKey={instanceKey}
            disabled={locked}
            onToggleVisible={toggleFillVisible}
            onRemove={removeFill}
            removeLabel="Remove fill"
            onCommitHex={(hex, opts) => {
              useEditorStore.getState().setNodeFillHex(node.id, hex, opts);
            }}
            onCommitOpacity={handleCommitFillOpacity}
          />
        ) : fillType === "gradient" ? (
          <>
            <GradientFillInspectorRow
              gradient={gradient}
              fillOpacity={fillOpacity}
              kindLabel={gradientKindLabel}
              visible={fillEnabled}
              disabled={locked}
              locked={locked}
              editorOpen={gradientEditorOpen}
              instanceKey={instanceKey}
              anchorRef={gradientAnchorRef}
              onOpenEditor={() => setGradientEditorOpen((open) => !open)}
              onToggleVisible={toggleFillVisible}
              onRemove={removeFill}
              onCommitOpacity={handleCommitFillOpacity}
            />
            <GradientFillEditorDialog
              open={gradientEditorOpen}
              onClose={() => setGradientEditorOpen(false)}
              anchorRef={gradientAnchorRef}
              nodeId={node.id}
              gradient={gradient}
              fillOpacity={fillOpacity}
              disabled={locked || !fillEnabled}
              remeasureKey={instanceKey}
              focusStop={editorFocus}
              onChange={(g, opts) => {
                onStyle(
                  {
                    fillType: "gradient",
                    fillGradient: g,
                    fillEnabled: true,
                  },
                  opts,
                );
              }}
            />
          </>
        ) : (
          <MediaFillInspectorRow
            kind={mediaFillKind}
            assetId={mediaFillAssetId}
            assets={assets}
            fillOpacity={fillOpacity}
            visible={fillEnabled}
            locked={locked}
            instanceKey={instanceKey}
            pickerOpen={mediaPickerOpen}
            anchorRef={mediaAnchorRef}
            onTogglePicker={() => setMediaPickerOpen((o) => !o)}
            onClosePicker={() => setMediaPickerOpen(false)}
            onToggleVisible={toggleFillVisible}
            onRemove={removeFill}
            onCommitOpacity={handleCommitFillOpacity}
            onSelectAsset={(assetId) => {
              onStyle(mediaFillAssetField(mediaFillKind, assetId));
              setMediaPickerOpen(false);
            }}
          />
        )}
      </div>
    </PropertiesSection>
  );
}
