"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { PropertiesSection } from "../PropertiesSection";
import { CornerRadiusControls } from "../CornerRadiusControls";
import { ArcControls } from "./ArcControls";
import { BlendModePicker } from "./BlendModePicker";
import { InspectorHintIconButton } from "./InspectorPrimitives";
import { OpacityIcon } from "./InspectorSettingIcons";
import { appFieldInnerClass, appFieldShellClass } from "@/lib/appFieldStyles";
import { handlePanelFieldKeyDown, keyboardNudgeStep } from "@/lib/panelFieldKeyboard";
import { useInspectorValueScrub } from "@/lib/useInspectorValueScrub";
import type { LayerBlendMode } from "@/lib/layerBlendMode";
import {
  inspectorFieldIconSlotClass,
  inspectorHeaderActionBtnClass,
  inspectorLucideProps,
} from "@/lib/inspectorIconStyles";
import { cn } from "@/lib/utils";
import type { EditorNode, NodeStylePatch } from "@/stores/useEditorStore";

function AppearanceOpacityField({
  value,
  instanceKey,
  disabled,
  onCommit,
}: {
  value: number;
  instanceKey: string;
  disabled?: boolean;
  onCommit: (opacity: number) => void;
}) {
  const percent = Math.round(value * 100);
  const [text, setText] = useState(() => String(percent));
  const [focused, setFocused] = useState(false);

  const commitPercent = (n: number) => {
    const clamped = Math.min(100, Math.max(0, Math.round(n)));
    onCommit(clamped / 100);
    setText(String(clamped));
  };

  const { scrubbing, scrubActiveRef, bindScrubInput } = useInspectorValueScrub({
    disabled,
    value: percent,
    min: 0,
    max: 100,
    onChange: commitPercent,
  });

  useEffect(() => {
    if (!focused && !scrubbing && !scrubActiveRef.current) setText(String(percent));
  }, [percent, instanceKey, focused, scrubbing, scrubActiveRef]);

  const applyDraft = (raw: string) => {
    const digits = raw.replace(/[^\d]/g, "");
    if (digits === "") return false;
    const n = parseInt(digits, 10);
    if (!Number.isFinite(n)) return false;
    commitPercent(n);
    return true;
  };

  return (
    <div className="min-w-0 flex-1">
      <div className="inspector-field-label mb-0.5">Opacity</div>
      <div className={cn(appFieldShellClass, disabled && "opacity-45")}>
        <span className={cn(inspectorFieldIconSlotClass, "text-app-fg/75")}>
          <OpacityIcon />
        </span>
        <input
          type="text"
          inputMode="numeric"
          disabled={disabled}
          aria-label="Opacity percent"
          {...bindScrubInput(
            cn(appFieldInnerClass, "tabular-nums"),
            focused,
          )}
          value={focused ? text : `${text}%`}
          onFocus={() => {
            setFocused(true);
            setText(String(percent));
          }}
          onChange={(e) => {
            const digits = e.target.value.replace(/[^\d]/g, "").slice(0, 3);
            setText(digits);
            if (digits !== "") {
              const n = parseInt(digits, 10);
              if (Number.isFinite(n)) commitPercent(n);
            }
          }}
          onBlur={() => {
            if (scrubActiveRef.current) return;
            setFocused(false);
            if (!applyDraft(text)) setText(String(percent));
          }}
          onKeyDown={(e) => {
            handlePanelFieldKeyDown(e, {
              onEnter: () => {
                if (!applyDraft(text)) setText(String(percent));
                e.currentTarget.blur();
              },
              onArrowNudge: (dir, shift, alt) => {
                const step = keyboardNudgeStep(1, 0, shift, alt) * dir;
                const current = parseInt(text, 10);
                const base = Number.isFinite(current) ? current : percent;
                commitPercent(base + step);
              },
            });
          }}
        />
      </div>
    </div>
  );
}

export function AppearanceSection({
  node,
  instanceKey,
  locked,
  visible,
  layerOpacity,
  canCornerRadius,
  cornerLabels,
  showArc,
  onOpacityCommit,
  onBlendModeChange,
  onToggleVisible,
  onCornerStyle,
  onArcStyle,
}: {
  node: EditorNode;
  instanceKey: string;
  locked: boolean;
  visible: boolean;
  layerOpacity: number;
  canCornerRadius: boolean;
  cornerLabels?: readonly string[];
  showArc?: boolean;
  onOpacityCommit: (opacity: number) => void;
  onBlendModeChange: (blendMode: LayerBlendMode) => void;
  onToggleVisible: () => void;
  onCornerStyle: (patch: NodeStylePatch) => void;
  onArcStyle: (patch: NodeStylePatch) => void;
}) {
  return (
    <PropertiesSection
      title="Appearance"
      defaultOpen
      headerActions={
        <>
          <InspectorHintIconButton
            title={visible ? "Hide layer" : "Show layer"}
            disabled={locked}
            onClick={onToggleVisible}
            className={cn(inspectorHeaderActionBtnClass, "inspector-icon-btn")}
          >
            {visible ? <Eye {...inspectorLucideProps()} /> : <EyeOff {...inspectorLucideProps()} />}
          </InspectorHintIconButton>
          <BlendModePicker
            node={node}
            disabled={locked}
            variant="icon"
            onChange={onBlendModeChange}
          />
        </>
      }
    >
      {canCornerRadius ? (
        <CornerRadiusControls
          node={node}
          instanceKey={instanceKey}
          locked={locked}
          cornerLabels={cornerLabels}
          variant="appearance"
          opacitySlot={
            <AppearanceOpacityField
              value={layerOpacity}
              instanceKey={`${instanceKey}-layer-op`}
              disabled={locked}
              onCommit={onOpacityCommit}
            />
          }
          onStyle={onCornerStyle}
        />
      ) : (
        <AppearanceOpacityField
          value={layerOpacity}
          instanceKey={`${instanceKey}-layer-op`}
          disabled={locked}
          onCommit={onOpacityCommit}
        />
      )}
      {showArc ? (
        <div className="border-t border-app-border-subtle pt-2">
          <ArcControls
            node={node}
            instanceKey={instanceKey}
            locked={locked}
            onStyle={onArcStyle}
          />
        </div>
      ) : null}
    </PropertiesSection>
  );
}
