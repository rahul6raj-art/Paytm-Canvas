"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { PropertyNumberInput } from "./PropertyInput";
import { DimensionFieldsIconButton } from "./design-panel/DimensionFieldsIconButton";
import {
  getShapeVertexCornerRadii,
  hasIndependentVertexCornerRadii,
} from "@/lib/shapes/parametricCornerRadii";
import { isPerCornerRadiusMode } from "@/lib/cornerRadius";
import { appFieldInnerClass, appFieldShellClass, inspectorRowGapClass, inspectorTwoColGridClass } from "@/lib/appFieldStyles";
import { handlePanelFieldKeyDown, keyboardNudgeStep } from "@/lib/panelFieldKeyboard";
import { useInspectorValueScrub } from "@/lib/useInspectorValueScrub";
import {
  CornerRadiusIcon,
  SingleCornerIcon,
} from "./design-panel/InspectorSettingIcons";
import {
  inspectorFieldIconSlotClass,
} from "@/lib/inspectorIconStyles";
import type { EditorNode, NodeStylePatch } from "@/stores/useEditorStore";
import { cn } from "@/lib/utils";

type CornerIndex = number;

const CORNER_LABELS = ["TL", "TR", "BR", "BL"] as const;

/** Figma 2×2 order: TL TR / BL BR */
const APPEARANCE_CORNER_ORDER: readonly CornerIndex[] = [0, 1, 3, 2];

const fieldShell = appFieldShellClass;

function CompactRadiusInput({
  value,
  disabled,
  locked,
  ariaLabel,
  icon,
  instanceKey,
  onCommit,
}: {
  value: number;
  disabled?: boolean;
  locked?: boolean;
  ariaLabel: string;
  icon: ReactNode;
  instanceKey: string;
  onCommit: (v: number) => void;
}) {
  const [text, setText] = useState(() => String(Math.round(value)));
  const [focused, setFocused] = useState(false);

  const commit = (n: number) => {
    const v = Math.max(0, Math.round(n));
    onCommit(v);
    setText(String(v));
  };

  const scrub = useInspectorValueScrub({
    disabled: disabled || locked,
    value: Math.round(value),
    min: 0,
    max: 999,
    onChange: commit,
  });
  const { scrubbing, scrubActiveRef, bindScrubInput } = scrub;

  useEffect(() => {
    if (!focused && !scrubbing && !scrubActiveRef.current) {
      setText(String(Math.round(value)));
    }
  }, [value, instanceKey, focused, scrubbing, scrubActiveRef]);

  const applyDraft = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === "" || trimmed === "-" || trimmed === ".") return false;
    const n = Number(trimmed);
    if (!Number.isFinite(n)) return false;
    commit(n);
    return true;
  };

  return (
    <div className={cn(fieldShell, (disabled || locked) && "opacity-45")}>
      <span className={inspectorFieldIconSlotClass}>{icon}</span>
      <input
        type="text"
        inputMode="numeric"
        disabled={disabled || locked}
        aria-label={ariaLabel}
        {...bindScrubInput(cn(appFieldInnerClass, "tabular-nums"), focused)}
        value={text}
        onFocus={() => {
          setFocused(true);
          setText(String(Math.round(value)));
        }}
        onChange={(e) => {
          const next = e.target.value.replace(/[^\d.-]/g, "");
          setText(next);
          const n = Number(next);
          if (next !== "" && Number.isFinite(n)) commit(n);
        }}
        onBlur={() => {
          if (scrubActiveRef.current) return;
          setFocused(false);
          if (!applyDraft(text)) setText(String(Math.round(value)));
        }}
        onKeyDown={(e) => {
          handlePanelFieldKeyDown(e, {
            onEnter: () => {
              if (!applyDraft(text)) setText(String(Math.round(value)));
              e.currentTarget.blur();
            },
            onArrowNudge: (dir, shift, alt) => {
              const step = keyboardNudgeStep(1, 0, shift, alt) * dir;
              const current = Number(text);
              const base = Number.isFinite(current) ? current : value;
              commit(base + step);
            },
          });
        }}
      />
    </div>
  );
}

export function CornerRadiusControls({
  node,
  instanceKey,
  locked,
  focusedCornerIndex = null,
  focusedCornerLabel,
  cornerLabels = CORNER_LABELS,
  variant = "default",
  opacitySlot,
  onStyle,
}: {
  node: EditorNode;
  instanceKey: string;
  locked: boolean;
  focusedCornerIndex?: CornerIndex | null;
  focusedCornerLabel?: string;
  cornerLabels?: readonly string[];
  variant?: "default" | "compact" | "appearance";
  /** Shown beside corner radius on the top row (appearance layout). */
  opacitySlot?: ReactNode;
  onStyle: (patch: NodeStylePatch) => void;
}) {
  const radii = getShapeVertexCornerRadii(node);
  const radiiMixed = hasIndependentVertexCornerRadii(radii);
  const [independent, setIndependent] = useState(
    () => isPerCornerRadiusMode(node) || focusedCornerIndex != null,
  );
  const uniformValue = radii[0] ?? 0;
  const [uniformText, setUniformText] = useState(() => String(Math.round(uniformValue)));
  const [uniformFocused, setUniformFocused] = useState(false);

  useEffect(() => {
    if (focusedCornerIndex != null) {
      setIndependent(true);
      return;
    }
    setIndependent(isPerCornerRadiusMode(node));
  }, [node.id, node.cornerRadius, node.cornerRadii, node.pathPoints, focusedCornerIndex]);

  const applyRadii = useCallback(
    (next: number[]) => {
      const allSame = next.length > 0 && next.every((r) => r === next[0]);
      if (allSame) {
        onStyle({
          cornerRadius: next[0],
          cornerRadii: undefined,
        });
      } else {
        onStyle({
          cornerRadius: undefined,
          cornerRadii: next,
        });
      }
    },
    [onStyle],
  );

  const setCorner = (index: CornerIndex, value: number) => {
    const next = [...radii];
    next[index] = Math.max(0, value);
    applyRadii(next);
  };

  const setUniform = (value: number) => {
    const v = Math.max(0, Math.round(value));
    if (independent) {
      const count = radii.length || 4;
      applyRadii(Array.from({ length: count }, () => v));
    } else {
      onStyle({ cornerRadius: v, cornerRadii: undefined });
    }
    setUniformText(String(v));
  };

  const toggleIndependent = () => {
    if (independent) {
      setIndependent(false);
      setUniform(radii[0] ?? 0);
    } else {
      setIndependent(true);
      onStyle({
        cornerRadius: undefined,
        cornerRadii: [...radii],
      });
    }
  };

  const applyUniformDraft = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === "" || trimmed === "-" || trimmed === ".") return false;
    const n = Number(trimmed);
    if (!Number.isFinite(n)) return false;
    setUniform(n);
    return true;
  };

  const uniformScrub = useInspectorValueScrub({
    disabled: locked,
    value: Math.round(uniformValue),
    min: 0,
    max: 999,
    onChange: setUniform,
  });
  const { scrubbing: uniformScrubbing, scrubActiveRef: uniformScrubActiveRef, bindScrubInput: bindUniformScrub } = uniformScrub;

  const showMixedUniform =
    radiiMixed && !uniformFocused && !uniformScrubbing && !uniformScrubActiveRef.current;

  useEffect(() => {
    if (!uniformFocused && !uniformScrubbing && !uniformScrubActiveRef.current && !radiiMixed) {
      setUniformText(String(Math.round(uniformValue)));
    }
  }, [uniformValue, instanceKey, uniformFocused, uniformScrubbing, uniformScrubActiveRef, radiiMixed]);

  const uniformField = (
    <div className={cn(fieldShell, "min-w-0 flex-1", locked && "opacity-45")}>
      <span className={inspectorFieldIconSlotClass}>
        <CornerRadiusIcon />
      </span>
      <input
        type="text"
        inputMode="numeric"
        disabled={locked}
        aria-label="Corner radius"
        {...bindUniformScrub(
          cn(
            "min-w-0 flex-1 border-0 bg-transparent px-1.5 py-0 text-ui tabular-nums text-app-field-fg focus-visible:outline-none disabled:cursor-not-allowed",
            showMixedUniform && "text-app-muted",
          ),
          uniformFocused,
        )}
        value={showMixedUniform ? "Mixed" : uniformText}
        onFocus={() => {
          setUniformFocused(true);
          if (radiiMixed) setUniformText(String(Math.round(uniformValue)));
        }}
        onChange={(e) => {
          if (showMixedUniform) return;
          const next = e.target.value.replace(/[^\d.-]/g, "");
          setUniformText(next);
          const n = Number(next);
          if (next !== "" && Number.isFinite(n)) setUniform(n);
        }}
        onBlur={() => {
          if (uniformScrubActiveRef.current) return;
          setUniformFocused(false);
          if (showMixedUniform) return;
          if (!applyUniformDraft(uniformText)) setUniformText(String(Math.round(uniformValue)));
        }}
        onKeyDown={(e) => {
          handlePanelFieldKeyDown(e, {
            onEnter: () => {
              if (!applyUniformDraft(uniformText)) setUniformText(String(Math.round(uniformValue)));
              e.currentTarget.blur();
            },
            onArrowNudge: (dir, shift, alt) => {
              const step = keyboardNudgeStep(1, 0, shift, alt) * dir;
              const current = Number(uniformText);
              const base = Number.isFinite(current) ? current : uniformValue;
              setUniform(base + step);
            },
          });
        }}
      />
    </div>
  );

  const toggleButton = (
    <DimensionFieldsIconButton
      title={independent ? "Use single radius for all corners" : "Set corners independently"}
      ariaLabel={independent ? "Use single radius for all corners" : "Set corners independently"}
      pressed={independent}
      active={independent}
      disabled={locked}
      onClick={toggleIndependent}
    >
      <CornerRadiusIcon />
    </DimensionFieldsIconButton>
  );

  if (variant === "appearance") {
    return (
      <div className="space-y-2">
        <div className={cn("flex items-start", inspectorRowGapClass)}>
          {opacitySlot}
          <div className="min-w-0 flex-1">
            <div className="inspector-field-label mb-0.5">Corner radius</div>
            <div className={cn("flex items-center", inspectorRowGapClass)}>
              {uniformField}
              {toggleButton}
            </div>
          </div>
        </div>
        {independent && focusedCornerIndex == null ? (
          <div className={inspectorTwoColGridClass}>
            {APPEARANCE_CORNER_ORDER.map((cornerIndex) => (
              <CompactRadiusInput
                key={cornerLabels[cornerIndex] ?? cornerIndex}
                value={radii[cornerIndex] ?? 0}
                locked={locked}
                ariaLabel={`${cornerLabels[cornerIndex] ?? cornerIndex} corner radius`}
                icon={<SingleCornerIcon corner={cornerIndex} />}
                instanceKey={`${instanceKey}-cr-${cornerLabels[cornerIndex] ?? cornerIndex}`}
                onCommit={(v) => setCorner(cornerIndex, v)}
              />
            ))}
          </div>
        ) : null}
        {independent && focusedCornerIndex != null ? (
          <CompactRadiusInput
            value={radii[focusedCornerIndex] ?? 0}
            locked={locked}
            ariaLabel={`${focusedCornerLabel ?? cornerLabels[focusedCornerIndex]} corner radius`}
            icon={<SingleCornerIcon corner={focusedCornerIndex} />}
            instanceKey={`${instanceKey}-cr-focus`}
            onCommit={(v) => setCorner(focusedCornerIndex, v)}
          />
        ) : null}
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div className="min-w-0 flex-1">
        <div className="inspector-field-label mb-0.5">Corner radius</div>
        <div className={cn("flex items-center", inspectorRowGapClass)}>
          {uniformField}
          {toggleButton}
        </div>
        {independent && focusedCornerIndex == null ? (
          <div className={cn("mt-1", inspectorTwoColGridClass)}>
            {APPEARANCE_CORNER_ORDER.map((cornerIndex) => (
              <CompactRadiusInput
                key={cornerLabels[cornerIndex] ?? cornerIndex}
                value={radii[cornerIndex] ?? 0}
                locked={locked}
                ariaLabel={`${cornerLabels[cornerIndex] ?? cornerIndex} corner radius`}
                icon={<SingleCornerIcon corner={cornerIndex} />}
                instanceKey={`${instanceKey}-cr-${cornerLabels[cornerIndex] ?? cornerIndex}`}
                onCommit={(v) => setCorner(cornerIndex, v)}
              />
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className={cn("flex items-end", inspectorRowGapClass)}>
        {toggleButton}
        {!independent ? (
          <div className="min-w-0 flex-1">
            <PropertyNumberInput
              commitOnInput={false}
              label="Radius"
              value={radii[0] ?? 0}
              instanceKey={`${instanceKey}-cr`}
              disabled={locked}
              min={0}
              max={999}
              onCommit={setUniform}
            />
          </div>
        ) : null}
      </div>

      {independent ? (
        focusedCornerIndex != null ? (
          <PropertyNumberInput
            commitOnInput={false}
            label={`${focusedCornerLabel ?? cornerLabels[focusedCornerIndex]} radius`}
            value={radii[focusedCornerIndex] ?? 0}
            instanceKey={`${instanceKey}-cr-focus`}
            disabled={locked}
            min={0}
            max={999}
            onCommit={(v) => setCorner(focusedCornerIndex, v)}
          />
        ) : (
          <div className="grid grid-cols-2 gap-x-2 gap-y-1">
            {cornerLabels.map((label, i) => (
              <PropertyNumberInput
                key={label}
                commitOnInput={false}
                label={label}
                value={radii[i as CornerIndex] ?? 0}
                instanceKey={`${instanceKey}-cr-${label}`}
                disabled={locked}
                min={0}
                max={999}
                onCommit={(v) => setCorner(i as CornerIndex, v)}
              />
            ))}
          </div>
        )
      ) : null}
    </div>
  );
}
