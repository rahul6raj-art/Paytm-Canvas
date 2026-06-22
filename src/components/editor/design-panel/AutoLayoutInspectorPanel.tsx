"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import {
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignHorizontalJustifyStart,
  AlignHorizontalSpaceBetween,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  AlignVerticalSpaceBetween,
  Check,
  ChevronDown,
  StretchHorizontal,
  StretchVertical,
} from "lucide-react";
import { PropertyNumberInput } from "../PropertyInput";
import { AutoLayoutAlignmentGrid } from "./AutoLayoutAlignmentGrid";
import {
  GapHorizontalIcon,
  GapVerticalIcon,
  LayoutDirectionColumnIcon,
  LayoutDirectionRowIcon,
  PaddingBottomIcon,
  PaddingExtendedIcon,
  PaddingHorizontalIcon,
  PaddingLeftIcon,
  PaddingRightIcon,
  PaddingTopIcon,
  PaddingVerticalIcon,
} from "./InspectorSettingIcons";
import { inferAutoLayoutGap, type LayoutMode, type LayoutNode } from "@/lib/autoLayout";
import { LAYOUT_GAP_MAX, sanitizeLayoutGapForFrame } from "@/lib/autoLayout/spacingPaddingDrag";
import { computeMinLayoutGap } from "@/lib/layoutEngine/minLayoutGap";
import { appFieldInnerClass, appFieldInnerClassCompact, appFieldRadius, appFieldShellClass, appFieldShellClassCompact, inspectorControlHeightClass, inspectorRowGapClass, inspectorTwoColGridClass } from "@/lib/appFieldStyles";
import {
  inspectorFieldIconButtonClass,
  inspectorFieldIconSlotClass,
  inspectorHeaderActionBtnClass,
  inspectorIconClass,
  inspectorIconStroke,
} from "@/lib/inspectorIconStyles";
import {
  anchoredMenuStyle,
  useAnchoredDropdownPosition,
  useDismissAnchoredDropdown,
} from "../useAnchoredDropdown";
import { handlePanelFieldKeyDown } from "@/lib/panelFieldKeyboard";
import { useInspectorValueScrub } from "@/lib/useInspectorValueScrub";
import { cn } from "@/lib/utils";
import { EditorHintWrap } from "@/components/editor/EditorHoverHint";
import { useEditorStore } from "@/stores/useEditorStore";
import type {
  CrossAxisAlign,
  EditorNode,
  PrimaryAxisAlign,
} from "@/stores/useEditorStore";
import type { LayoutEngineNode } from "@/lib/layoutEngine/types";

function layoutToggleBtn(active: boolean) {
  return cn(
    "flex h-6 flex-1 items-center justify-center rounded-[5px] transition-colors disabled:opacity-40",
    active ? "bg-app-panel text-app-fg shadow-sm" : "text-app-muted hover:text-app-fg",
  );
}

function AutoLayoutGapField({
  layoutMode,
  node,
  frameId,
  nodesAll,
  childOrder,
  locked,
  instanceKey,
  onUpdateGap,
  onSetGapAuto,
}: {
  layoutMode: LayoutMode;
  node: EditorNode;
  frameId: string;
  nodesAll: Record<string, EditorNode>;
  childOrder: Record<string, string[]>;
  locked: boolean;
  instanceKey: string;
  onUpdateGap: (gap: number) => void;
  onSetGapAuto: (auto: boolean) => void;
}) {
  const gapValue = sanitizeLayoutGapForFrame(frameId, nodesAll, childOrder, node.layoutGap);
  const minGap = computeMinLayoutGap(frameId, nodesAll as Record<string, LayoutEngineNode>, childOrder);
  const GapIcon = layoutMode === "vertical" ? GapVerticalIcon : GapHorizontalIcon;
  const isAuto = node.layoutGapAuto;

  const [text, setText] = useState(String(gapValue));
  const [focused, setFocused] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const chevronRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  const position = useAnchoredDropdownPosition(chevronRef, menuOpen, 4, {
    viewportClamp: true,
    width: 168,
  });
  useDismissAnchoredDropdown(menuOpen, () => setMenuOpen(false), chevronRef, menuRef);

  useEffect(() => {
    if (!focused) setText(String(gapValue));
  }, [gapValue, instanceKey, focused]);

  const commit = (raw: string) => {
    const n = Number(raw.trim());
    if (!Number.isFinite(n)) return;
    const next = Math.min(LAYOUT_GAP_MAX, Math.max(minGap, Math.round(n)));
    onUpdateGap(next);
    setText(String(next));
  };

  const selectFixed = () => {
    if (isAuto) onSetGapAuto(false);
  };

  const { scrubActiveRef, bindScrubInput } = useInspectorValueScrub({
    disabled: locked || isAuto,
    value: gapValue,
    decimals: 0,
    step: 1,
    min: minGap,
    max: LAYOUT_GAP_MAX,
    onChange: (v) => {
      onUpdateGap(v);
      setText(String(v));
    },
  });

  const gapInputProps = {
    type: "text" as const,
    inputMode: "decimal" as const,
    disabled: locked,
    value: text,
    "aria-label": "Gap",
    onFocus: () => {
      setFocused(true);
      selectFixed();
    },
    onBlur: () => {
      if (scrubActiveRef.current) return;
      setFocused(false);
      commit(text);
    },
    onChange: (e: ChangeEvent<HTMLInputElement>) => setText(e.target.value),
    onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => {
      handlePanelFieldKeyDown(e, {
        onEnter: () => {
          commit(text);
          e.currentTarget.blur();
        },
        onArrowNudge: (dir, shift) => {
          const step = shift ? 10 : 1;
          const n = Number(text);
          const base = Number.isFinite(n) ? n : gapValue;
          commit(String(base + dir * step));
        },
      });
    },
  };

  const inputClass = cn(
    appFieldInnerClass,
    "font-mono tabular-nums",
  );

  const menu =
    menuOpen && mounted ? (
      <div
        ref={menuRef}
        role="listbox"
        aria-label="Gap mode"
        className="fixed z-[120] w-[168px] overflow-hidden editor-floating-menu"
        style={anchoredMenuStyle(position)}
      >
        <button
          type="button"
          role="option"
          aria-selected={!isAuto}
          disabled={locked}
          className={cn(
            "flex w-full items-center gap-2 px-2 py-1 text-left transition-colors hover:bg-app-hover disabled:opacity-40",
            !isAuto && "bg-app-hover",
          )}
          onClick={selectFixed}
        >
          <span className="flex h-4 w-4 shrink-0 items-center justify-center">
            {!isAuto ? <Check className={inspectorIconClass} strokeWidth={inspectorIconStroke} /> : null}
          </span>
          <input
            {...gapInputProps}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            className={cn(inputClass, appFieldInnerClassCompact, "h-6 px-1.5")}
          />
        </button>
        <button
          type="button"
          role="option"
          aria-selected={isAuto}
          disabled={locked}
          className={cn(
            "flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-ui text-app-fg transition-colors hover:bg-app-hover disabled:opacity-40",
            isAuto && "bg-app-hover",
          )}
          onClick={() => {
            onSetGapAuto(true);
            setMenuOpen(false);
          }}
        >
          <span className="flex h-4 w-4 shrink-0 items-center justify-center">
            {isAuto ? <Check className={inspectorIconClass} strokeWidth={inspectorIconStroke} /> : null}
          </span>
          <span>Auto</span>
        </button>
      </div>
    ) : null;

  return (
    <>
      <div
        className={cn(
          appFieldShellClass,
          locked && "opacity-45",
        )}
      >
        <div
          className={cn(
            inspectorFieldIconSlotClass,
            "h-full border-r border-app-border",
            isAuto && "text-accent",
          )}
          aria-hidden
        >
          <GapIcon />
        </div>
        {isAuto ? (
          <div className="flex min-w-0 flex-1 items-center px-2 text-ui text-app-fg">Auto</div>
        ) : (
          <input
            {...gapInputProps}
            {...bindScrubInput(inputClass, focused)}
          />
        )}
        <EditorHintWrap title="Gap mode" disabled={locked}>
          <button
            ref={chevronRef}
            type="button"
            disabled={locked}
            aria-haspopup="listbox"
            aria-expanded={menuOpen}
            aria-label="Gap mode"
            onClick={() => setMenuOpen((v) => !v)}
            className={cn(
              inspectorFieldIconSlotClass,
              "border-r-0 border-l text-app-muted transition-colors",
              locked ? "opacity-45" : "hover:bg-app-hover hover:text-app-fg",
            )}
          >
            <ChevronDown
              className={cn(inspectorIconClass, "transition-transform", menuOpen && "rotate-180")}
              strokeWidth={inspectorIconStroke}
            />
          </button>
        </EditorHintWrap>
      </div>
      {mounted && menu ? createPortal(menu, document.body) : null}
    </>
  );
}

export function AutoLayoutInspectorPanel({
  node,
  frameId,
  instanceKey,
  locked,
  layoutMode,
  nodesAll,
  childOrder,
  updateLayout,
}: {
  node: EditorNode;
  frameId: string;
  instanceKey: string;
  locked: boolean;
  layoutMode: Exclude<LayoutMode, "none">;
  nodesAll: Record<string, EditorNode>;
  childOrder: Record<string, string[]>;
  updateLayout: (id: string, patch: Partial<EditorNode>) => void;
}) {
  const designTokens = useEditorStore((s) => s.designTokens);
  const gapTokenName =
    node.projectSpacingTokenIds?.layoutGap &&
    designTokens[node.projectSpacingTokenIds.layoutGap]
      ? designTokens[node.projectSpacingTokenIds.layoutGap]!.name
      : null;
  const paddingLeft = node.paddingLeft ?? 0;
  const paddingRight = node.paddingRight ?? 0;
  const paddingTop = node.paddingTop ?? 0;
  const paddingBottom = node.paddingBottom ?? 0;
  const hasIndividualPadding = paddingLeft !== paddingRight || paddingTop !== paddingBottom;

  const [paddingExpanded, setPaddingExpanded] = useState(hasIndividualPadding);
  const layoutHorizontal = layoutMode === "horizontal";

  useEffect(() => {
    setPaddingExpanded(hasIndividualPadding);
  }, [instanceKey, hasIndividualPadding]);

  const collapsePadding = useCallback(() => {
    updateLayout(frameId, {
      paddingLeft,
      paddingRight: paddingLeft,
      paddingTop,
      paddingBottom: paddingTop,
    });
    setPaddingExpanded(false);
  }, [frameId, paddingBottom, paddingLeft, paddingRight, paddingTop, updateLayout]);

  const setGapAuto = useCallback(
    (auto: boolean) => {
      const flowKids = (childOrder[frameId] ?? []).filter((cid) => {
        const c = nodesAll[cid];
        return c?.visible && !c.locked;
      });
      const inferred =
        flowKids.length >= 2
          ? inferAutoLayoutGap(nodesAll as Record<string, LayoutNode>, flowKids, layoutMode)
          : 0;
      updateLayout(frameId, { layoutGapAuto: auto, layoutGap: inferred });
    },
    [childOrder, frameId, layoutMode, nodesAll, updateLayout],
  );

  const primaryExtras = layoutHorizontal
    ? ([
        { v: "space-between" as const, Icon: AlignHorizontalSpaceBetween, title: "Space between" },
      ] as const)
    : ([
        { v: "space-between" as const, Icon: AlignVerticalSpaceBetween, title: "Space between" },
      ] as const);

  const counterExtras = layoutHorizontal
    ? ([{ v: "stretch" as const, Icon: StretchVertical, title: "Stretch" }] as const)
    : ([{ v: "stretch" as const, Icon: StretchHorizontal, title: "Stretch" }] as const);

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div>
            <div className="inspector-field-label mb-0.5">Flow</div>
            <div
              className={cn(
                "flex items-center rounded-md border border-app-border bg-app-inset p-0.5",
                inspectorControlHeightClass,
              )}
              role="group"
              aria-label="Flow"
            >
            <EditorHintWrap title="Horizontal" disabled={locked}>
              <button
                type="button"
                disabled={locked}
                aria-label="Horizontal"
                onClick={() => updateLayout(frameId, { layoutMode: "horizontal" })}
                className={layoutToggleBtn(layoutHorizontal)}
              >
                <LayoutDirectionRowIcon />
              </button>
            </EditorHintWrap>
            <EditorHintWrap title="Vertical" disabled={locked}>
              <button
                type="button"
                disabled={locked}
                aria-label="Vertical"
                onClick={() => updateLayout(frameId, { layoutMode: "vertical" })}
                className={layoutToggleBtn(!layoutHorizontal)}
              >
                <LayoutDirectionColumnIcon />
              </button>
            </EditorHintWrap>
          </div>
          </div>
          <div>
            <div className="inspector-field-label mb-0.5">
              Gap
              {gapTokenName ? (
                <span className="ml-1 font-normal text-app-muted">· {gapTokenName}</span>
              ) : null}
            </div>
            <AutoLayoutGapField
            layoutMode={layoutMode}
            node={node}
            frameId={frameId}
            nodesAll={nodesAll}
            childOrder={childOrder}
            locked={locked}
            instanceKey={`${instanceKey}-gap`}
            onSetGapAuto={setGapAuto}
            onUpdateGap={(gap) =>
              updateLayout(frameId, {
                layoutGap: sanitizeLayoutGapForFrame(frameId, nodesAll, childOrder, gap),
                layoutGapAuto: false,
              })
            }
          />
          </div>
        </div>
        <div>
          <div className="inspector-field-label mb-0.5">Alignment</div>
          <AutoLayoutAlignmentGrid
          layoutHorizontal={layoutHorizontal}
          primaryAxisAlign={node.primaryAxisAlign}
          counterAxisAlign={node.counterAxisAlign}
          disabled={locked}
          onChange={(primary, counter) =>
            updateLayout(frameId, { primaryAxisAlign: primary, counterAxisAlign: counter })
          }
        />
        </div>
      </div>

      <div>
        {paddingExpanded ? (
          <>
            <div className="mb-1 flex items-center justify-between gap-2">
              <div className="inspector-field-label mb-0">Padding</div>
              <button
                type="button"
                disabled={locked}
                onClick={collapsePadding}
                className="text-ui text-app-subtle transition-colors hover:text-app-fg disabled:opacity-40"
              >
                Close
              </button>
            </div>
            <div className={inspectorTwoColGridClass}>
              <PropertyNumberInput
                commitOnInput={false}
                label="Padding left"
                leadingIcon={<PaddingLeftIcon />}
                value={paddingLeft}
                instanceKey={`${instanceKey}-pl`}
                disabled={locked}
                min={0}
                max={999}
                onCommit={(v) => updateLayout(frameId, { paddingLeft: Math.max(0, v) })}
              />
              <PropertyNumberInput
                commitOnInput={false}
                label="Padding right"
                leadingIcon={<PaddingRightIcon />}
                value={paddingRight}
                instanceKey={`${instanceKey}-pr`}
                disabled={locked}
                min={0}
                max={999}
                onCommit={(v) => updateLayout(frameId, { paddingRight: Math.max(0, v) })}
              />
              <PropertyNumberInput
                commitOnInput={false}
                label="Padding top"
                leadingIcon={<PaddingTopIcon />}
                value={paddingTop}
                instanceKey={`${instanceKey}-pt`}
                disabled={locked}
                min={0}
                max={999}
                onCommit={(v) => updateLayout(frameId, { paddingTop: Math.max(0, v) })}
              />
              <PropertyNumberInput
                commitOnInput={false}
                label="Padding bottom"
                leadingIcon={<PaddingBottomIcon />}
                value={paddingBottom}
                instanceKey={`${instanceKey}-pb`}
                disabled={locked}
                min={0}
                max={999}
                onCommit={(v) => updateLayout(frameId, { paddingBottom: Math.max(0, v) })}
              />
            </div>
          </>
        ) : (
          <>
            <div className="inspector-field-label mb-0.5">Padding</div>
            <div className={cn("flex items-center", inspectorRowGapClass)}>
            <div className={cn("grid min-w-0 flex-1 grid-cols-2", inspectorRowGapClass)}>
              <PropertyNumberInput
                commitOnInput={false}
                label="Horizontal padding"
                leadingIcon={<PaddingHorizontalIcon />}
                value={paddingLeft}
                instanceKey={`${instanceKey}-ph`}
                disabled={locked}
                min={0}
                max={999}
                onCommit={(v) => {
                  const n = Math.max(0, v);
                  updateLayout(frameId, { paddingLeft: n, paddingRight: n });
                }}
              />
              <PropertyNumberInput
                commitOnInput={false}
                label="Vertical padding"
                leadingIcon={<PaddingVerticalIcon />}
                value={paddingTop}
                instanceKey={`${instanceKey}-pv`}
                disabled={locked}
                min={0}
                max={999}
                onCommit={(v) => {
                  const n = Math.max(0, v);
                  updateLayout(frameId, { paddingTop: n, paddingBottom: n });
                }}
              />
            </div>
            <EditorHintWrap title="Individual padding" disabled={locked}>
              <button
                type="button"
                disabled={locked}
                aria-label="Individual padding"
                onClick={() => setPaddingExpanded(true)}
                className={cn(
                  inspectorFieldIconButtonClass,
                  "rounded-md bg-app-inset",
                  hasIndividualPadding && "border-accent/40 text-accent",
                )}
              >
                <PaddingExtendedIcon />
              </button>
            </EditorHintWrap>
          </div>
          </>
        )}
      </div>

      <details className="group">
        <summary className="cursor-pointer list-none text-ui text-app-subtle transition-colors hover:text-app-fg [&::-webkit-details-marker]:hidden">
          More options
        </summary>
        <div className="mt-2 space-y-2 border-t border-app-border pt-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-ui text-app-subtle">Wrap lines</span>
            <button
              type="button"
              disabled={locked}
              onClick={() => updateLayout(frameId, { layoutWrap: !node.layoutWrap })}
              className={cn(
                "rounded border px-2 py-0.5 text-ui font-medium transition-colors disabled:opacity-40",
                node.layoutWrap
                  ? "border-accent/40 bg-accent/15 text-accent"
                  : "border-app-border text-app-muted hover:bg-app-hover",
              )}
            >
              {node.layoutWrap ? "On" : "Off"}
            </button>
          </div>
          <div className="flex flex-wrap gap-0.5">
            {(layoutHorizontal
              ? ([
                  { v: "start" as const, Icon: AlignHorizontalJustifyStart, title: "Start" },
                  { v: "center" as const, Icon: AlignHorizontalJustifyCenter, title: "Center" },
                  { v: "end" as const, Icon: AlignHorizontalJustifyEnd, title: "End" },
                  ...primaryExtras,
                ] as const)
              : ([
                  { v: "start" as const, Icon: AlignVerticalJustifyStart, title: "Start" },
                  { v: "center" as const, Icon: AlignVerticalJustifyCenter, title: "Center" },
                  { v: "end" as const, Icon: AlignVerticalJustifyEnd, title: "End" },
                  ...primaryExtras,
                ] as const)
            ).map(({ v, Icon, title }) => {
              const cur = (node.primaryAxisAlign ?? "start") as PrimaryAxisAlign;
              const active = cur === v;
              return (
                <EditorHintWrap key={v} title={title} disabled={locked}>
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() => updateLayout(frameId, { primaryAxisAlign: v })}
                    className={cn(
                      "flex h-6 w-8 items-center justify-center rounded border transition-colors disabled:opacity-40",
                      active
                        ? "border-accent/45 bg-accent/15 text-white"
                        : "border-app-border text-app-muted hover:bg-app-hover",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </button>
                </EditorHintWrap>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-0.5">
            {(layoutHorizontal
              ? ([
                  { v: "start" as const, Icon: AlignVerticalJustifyStart, title: "Start" },
                  { v: "center" as const, Icon: AlignVerticalJustifyCenter, title: "Center" },
                  { v: "end" as const, Icon: AlignVerticalJustifyEnd, title: "End" },
                  ...counterExtras,
                ] as const)
              : ([
                  { v: "start" as const, Icon: AlignHorizontalJustifyStart, title: "Start" },
                  { v: "center" as const, Icon: AlignHorizontalJustifyCenter, title: "Center" },
                  { v: "end" as const, Icon: AlignHorizontalJustifyEnd, title: "End" },
                  ...counterExtras,
                ] as const)
            ).map(({ v, Icon, title }) => {
              const cur = (node.counterAxisAlign ?? "start") as CrossAxisAlign;
              const active = cur === v;
              return (
                <EditorHintWrap key={v} title={title} disabled={locked}>
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() => updateLayout(frameId, { counterAxisAlign: v })}
                    className={cn(
                      "flex h-6 w-8 items-center justify-center rounded border transition-colors disabled:opacity-40",
                      active
                        ? "border-accent/45 bg-accent/15 text-white"
                        : "border-app-border text-app-muted hover:bg-app-hover",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </button>
                </EditorHintWrap>
              );
            })}
          </div>
          <div className={inspectorTwoColGridClass}>
            <PropertyNumberInput
              commitOnInput={false}
              label="Min W"
              value={node.minWidth ?? 0}
              instanceKey={`${instanceKey}-minw`}
              disabled={locked}
              min={0}
              max={99999}
              onCommit={(v) => updateLayout(frameId, { minWidth: v > 0 ? v : undefined })}
            />
            <PropertyNumberInput
              commitOnInput={false}
              label="Max W"
              value={node.maxWidth ?? 0}
              instanceKey={`${instanceKey}-maxw`}
              disabled={locked}
              min={0}
              max={99999}
              onCommit={(v) => updateLayout(frameId, { maxWidth: v > 0 ? v : undefined })}
            />
            <PropertyNumberInput
              commitOnInput={false}
              label="Min H"
              value={node.minHeight ?? 0}
              instanceKey={`${instanceKey}-minh`}
              disabled={locked}
              min={0}
              max={99999}
              onCommit={(v) => updateLayout(frameId, { minHeight: v > 0 ? v : undefined })}
            />
            <PropertyNumberInput
              commitOnInput={false}
              label="Max H"
              value={node.maxHeight ?? 0}
              instanceKey={`${instanceKey}-maxh`}
              disabled={locked}
              min={0}
              max={99999}
              onCommit={(v) => updateLayout(frameId, { maxHeight: v > 0 ? v : undefined })}
            />
          </div>
        </div>
      </details>
    </div>
  );
}
