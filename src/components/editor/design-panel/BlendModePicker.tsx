"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Droplet } from "lucide-react";
import {
  blendModeGroupsForNode,
  defaultLayerBlendMode,
  effectiveLayerBlendMode,
  LAYER_BLEND_MODE_LABELS,
  type LayerBlendMode,
} from "@/lib/layerBlendMode";
import type { EditorNode } from "@/stores/useEditorStore";
import {
  inspectorHeaderActionBtnClass,
  inspectorIconClass,
  inspectorIconStroke,
  inspectorLucideProps,
} from "@/lib/inspectorIconStyles";
import { cn } from "@/lib/utils";
import { EditorHintWrap } from "@/components/editor/EditorHoverHint";
import {
  anchoredMenuStyle,
  useAnchoredDropdownPosition,
  useDismissAnchoredDropdown,
} from "../useAnchoredDropdown";

type BlendModePickerProps = {
  node: Pick<EditorNode, "type" | "blendMode">;
  disabled?: boolean;
  onChange: (mode: LayerBlendMode) => void;
  /** Icon-only trigger for compact section headers. */
  variant?: "default" | "icon";
};

export function BlendModePicker({ node, disabled, onChange, variant = "default" }: BlendModePickerProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const value = effectiveLayerBlendMode(node);
  const label = LAYER_BLEND_MODE_LABELS[value];
  const groups = blendModeGroupsForNode(node);
  const isDefaultBlend = value === defaultLayerBlendMode(node);

  const position = useAnchoredDropdownPosition(anchorRef, open, 4, {
    viewportClamp: true,
    maxHeight: 400,
    width: 220,
  });
  useDismissAnchoredDropdown(open, () => setOpen(false), anchorRef, menuRef);

  useEffect(() => setMounted(true), []);

  const menu =
    open && mounted ? (
      <div
        ref={menuRef}
        role="listbox"
        aria-label="Blend mode"
        data-editor-shell
        className={cn(
          "editor-floating-menu editor-menu-dropdown fixed min-w-[220px] overflow-y-auto overscroll-contain",
          "border border-app-border bg-app-surface py-1 shadow-xl thin-scroll",
          "z-[120]",
        )}
        style={anchoredMenuStyle(position)}
      >
        {groups.map((group, gi) => (
          <div key={gi}>
            {gi > 0 ? <div className="my-1 border-t border-app-border-subtle" role="separator" /> : null}
            {group.modes.map((mode) => {
              const selected = mode === value;
              return (
                <button
                  key={mode}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={cn(
                    "editor-menu-dropdown-item !justify-start gap-2.5",
                    selected && "bg-app-inset font-medium text-app-fg",
                  )}
                  onClick={() => {
                    onChange(mode);
                    setOpen(false);
                  }}
                >
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                    {selected ? (
                      <Check className={cn(inspectorIconClass, "text-app-fg")} strokeWidth={inspectorIconStroke} />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{LAYER_BLEND_MODE_LABELS[mode]}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    ) : null;

  const triggerClass =
    variant === "icon"
      ? cn(
          inspectorHeaderActionBtnClass,
          "inspector-icon-btn",
          !isDefaultBlend && "text-accent",
        )
      : cn(
          "flex h-6 min-w-[108px] max-w-full items-center justify-between gap-1 rounded border border-app-border bg-app-panel px-1.5 text-ui text-app-fg transition-colors hover:bg-app-hover disabled:opacity-40",
        );

  return (
    <>
      <EditorHintWrap
        title={variant === "icon" ? `Blend: ${label}` : undefined}
        disabled={disabled}
      >
        <button
          ref={anchorRef}
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={variant === "icon" ? `Blend mode: ${label}` : undefined}
          onClick={() => setOpen((v) => !v)}
          className={triggerClass}
        >
          {variant === "icon" ? (
            <Droplet {...inspectorLucideProps()} />
          ) : (
            <>
              <span className="truncate">{label}</span>
              <ChevronDown className={cn(inspectorIconClass, "text-app-muted")} strokeWidth={inspectorIconStroke} />
            </>
          )}
        </button>
      </EditorHintWrap>
      {mounted && menu ? createPortal(menu, document.body) : null}
    </>
  );
}
