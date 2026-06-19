"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Eye, EyeOff, Minus } from "lucide-react";
import { PropertiesSection } from "../PropertiesSection";
import { ColorInput } from "../ColorInput";
import { PropertyNumberInput } from "../PropertyInput";
import { InspectorInsetSelect, InspectorLabelRow, InspectorSectionAddButton, InspectorHintIconButton } from "./InspectorPrimitives";
import {
  EffectBlurIcon,
  EffectOffsetXIcon,
  EffectOffsetYIcon,
  EffectSpreadIcon,
} from "./InspectorSettingIcons";
import {
  EFFECT_TYPE_OPTIONS,
  effectTypeLabel,
  isBlurEffect,
  isShadowEffect,
  type NodeEffect,
  type NodeEffectType,
  type NoiseEffectMode,
} from "@/lib/nodeEffects";
import type { DesignToken } from "@/lib/designTokens";
import { inspectorTwoColGridClass } from "@/lib/appFieldStyles";
import {
  inspectorIconClass,
  inspectorIconStroke,
  inspectorLucideProps,
  inspectorRowActionBtnClass,
} from "@/lib/inspectorIconStyles";
import { cn } from "@/lib/utils";
import {
  adjacentPanelDialogStyle,
  useAdjacentPanelDialogPosition,
} from "../useAdjacentPanelDialogPosition";
import { useDismissAnchoredDropdown } from "../useAnchoredDropdown";

export function EffectsSection({
  instanceKey,
  locked,
  effects,
  effectToken,
  hasEffectToken,
  onAddEffect,
  onDetachEffectToken,
  onToggleEffect,
  onDeleteEffect,
  onUpdateEffect,
  onChangeEffectType,
}: {
  instanceKey: string;
  locked: boolean;
  effects: NodeEffect[];
  effectToken: DesignToken | undefined;
  hasEffectToken: boolean;
  onAddEffect: (type: NodeEffectType) => void;
  onDetachEffectToken: () => void;
  onToggleEffect: (effectId: string) => void;
  onDeleteEffect: (effectId: string) => void;
  onUpdateEffect: (effectId: string, patch: Partial<NodeEffect>) => void;
  onChangeEffectType: (effectId: string, type: NodeEffectType) => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const position = useAdjacentPanelDialogPosition(addButtonRef, addOpen, {
    width: 220,
    maxHeight: 280,
  });
  useDismissAnchoredDropdown(addOpen, () => setAddOpen(false), addButtonRef, menuRef);

  useEffect(() => setMounted(true), []);

  const addMenu =
    addOpen && mounted ? (
      <ul
        ref={menuRef}
        role="menu"
        aria-label="Add effect"
        data-editor-shell
        className="fixed z-[120] overflow-y-auto overscroll-contain editor-floating-menu"
        style={adjacentPanelDialogStyle(position)}
      >
        {EFFECT_TYPE_OPTIONS.map((opt) => (
          <li key={opt.type}>
            <button
              type="button"
              role="menuitem"
              disabled={locked}
              onClick={() => {
                onAddEffect(opt.type);
                setAddOpen(false);
              }}
            >
              {opt.label}
            </button>
          </li>
        ))}
      </ul>
    ) : null;

  return (
    <PropertiesSection
      title="Effects"
      headerActions={
        <InspectorSectionAddButton
          title="Add effect"
          disabled={locked}
          buttonRef={addButtonRef}
          onClick={() => setAddOpen((o) => !o)}
        />
      }
    >
      {effectToken ? (
        <p className="mb-1.5 truncate text-ui text-app-muted">
          Style: <span className="font-medium text-app-fg">{effectToken.name}</span>
        </p>
      ) : null}
      {hasEffectToken ? (
        <div className="mb-2 flex flex-wrap gap-1">
          <button
            type="button"
            disabled={locked}
            onClick={onDetachEffectToken}
            className="rounded border border-app-border bg-app-panel px-2 py-0.5 text-ui font-medium text-app-fg hover:bg-app-hover disabled:opacity-40"
          >
            Detach
          </button>
        </div>
      ) : null}

      {effects.length > 0 ? (
        <ul className="space-y-2">
          {effects.map((e) => (
            <EffectRow
              key={e.id}
              effect={e}
              instanceKey={instanceKey}
              locked={locked}
              onToggle={() => onToggleEffect(e.id)}
              onDelete={() => onDeleteEffect(e.id)}
              onUpdate={(patch) => onUpdateEffect(e.id, patch)}
              onChangeType={(type) => onChangeEffectType(e.id, type)}
            />
          ))}
        </ul>
      ) : null}
      {mounted && addMenu ? createPortal(addMenu, document.body) : null}
    </PropertiesSection>
  );
}

function EffectRow({
  effect: e,
  instanceKey,
  locked,
  onToggle,
  onDelete,
  onUpdate,
  onChangeType,
}: {
  effect: NodeEffect;
  instanceKey: string;
  locked: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onUpdate: (patch: Partial<NodeEffect>) => void;
  onChangeType: (type: NodeEffectType) => void;
}) {
  const disabled = locked || !e.visible;

  return (
    <li className="rounded-lg border border-app-border-subtle bg-app-inset p-2">
      <div className="mb-2 flex items-center gap-2">
        <InspectorInsetSelect
          disabled={locked}
          value={e.type}
          shellClassName="min-w-0 flex-1 font-medium"
          aria-label="Effect type"
          onChange={(ev) => onChangeType(ev.target.value as NodeEffectType)}
        >
          {EFFECT_TYPE_OPTIONS.map((opt) => (
            <option key={opt.type} value={opt.type}>
              {opt.label}
            </option>
          ))}
        </InspectorInsetSelect>
        <InspectorHintIconButton
          title={e.visible ? "Hide effect" : "Show effect"}
          disabled={locked}
          onClick={onToggle}
          className={cn(inspectorRowActionBtnClass, "inspector-icon-btn h-6 w-6")}
        >
          {e.visible ? <Eye {...inspectorLucideProps()} /> : <EyeOff {...inspectorLucideProps()} />}
        </InspectorHintIconButton>
        <button
          type="button"
          disabled={locked}
          onClick={onDelete}
          className={cn(inspectorRowActionBtnClass, "inspector-icon-btn h-6 w-6 hover:text-rose-300")}
          aria-label={`Remove ${effectTypeLabel(e.type)}`}
        >
          <Minus className={inspectorIconClass} strokeWidth={inspectorIconStroke} />
        </button>
      </div>

      {isShadowEffect(e.type) ? (
        <ShadowEffectFields effect={e} instanceKey={instanceKey} disabled={disabled} onUpdate={onUpdate} />
      ) : null}

      {isBlurEffect(e.type) ? (
        <BlurEffectFields effect={e} instanceKey={instanceKey} disabled={disabled} onUpdate={onUpdate} />
      ) : null}

      {e.type === "noise" ? (
        <NoiseEffectFields effect={e} instanceKey={instanceKey} disabled={disabled} onUpdate={onUpdate} />
      ) : null}

      {e.type === "texture" ? (
        <TextureEffectFields effect={e} instanceKey={instanceKey} disabled={disabled} onUpdate={onUpdate} />
      ) : null}

      {e.type === "glass" ? (
        <GlassEffectFields effect={e} instanceKey={instanceKey} disabled={disabled} onUpdate={onUpdate} />
      ) : null}
    </li>
  );
}

function ShadowEffectFields({
  effect: e,
  instanceKey,
  disabled,
  onUpdate,
}: {
  effect: NodeEffect;
  instanceKey: string;
  disabled: boolean;
  onUpdate: (patch: Partial<NodeEffect>) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className={inspectorTwoColGridClass}>
        <PropertyNumberInput
          commitOnInput
          label="X"
          leadingIcon={<EffectOffsetXIcon />}
          value={e.x ?? 0}
          instanceKey={`${instanceKey}-efx-${e.id}-x`}
          disabled={disabled}
          onCommit={(v) => onUpdate({ x: v })}
        />
        <PropertyNumberInput
          commitOnInput
          label="Y"
          leadingIcon={<EffectOffsetYIcon />}
          value={e.y ?? 0}
          instanceKey={`${instanceKey}-efx-${e.id}-y`}
          disabled={disabled}
          onCommit={(v) => onUpdate({ y: v })}
        />
        <PropertyNumberInput
          commitOnInput
          label="Blur"
          leadingIcon={<EffectBlurIcon />}
          value={e.blur ?? 0}
          instanceKey={`${instanceKey}-efx-${e.id}-blur`}
          disabled={disabled}
          min={0}
          max={256}
          onCommit={(v) => onUpdate({ blur: v })}
        />
        <PropertyNumberInput
          commitOnInput
          label="Spread"
          leadingIcon={<EffectSpreadIcon />}
          value={e.spread ?? 0}
          instanceKey={`${instanceKey}-efx-${e.id}-spread`}
          disabled={disabled}
          onCommit={(v) => onUpdate({ spread: v })}
        />
      </div>
      <ColorInput
        variant="inspectorRow"
        hex={e.color ?? "#000000"}
        opacity={e.opacity ?? 1}
        instanceKey={`${instanceKey}-efx-${e.id}-c`}
        disabled={disabled}
        pickerTitle="Shadow color"
        onCommitHex={(hex) => onUpdate({ color: hex })}
        onCommitOpacity={(opacity) => onUpdate({ opacity })}
      />
    </div>
  );
}

function BlurEffectFields({
  effect: e,
  instanceKey,
  disabled,
  onUpdate,
}: {
  effect: NodeEffect;
  instanceKey: string;
  disabled: boolean;
  onUpdate: (patch: Partial<NodeEffect>) => void;
}) {
  return (
    <div className="space-y-1.5">
      <PropertyNumberInput
        commitOnInput
        label="Blur"
        leadingIcon={<EffectBlurIcon />}
        value={e.blur ?? 0}
        instanceKey={`${instanceKey}-efx-${e.id}-blur`}
        disabled={disabled}
        min={0}
        max={256}
        onCommit={(v) => onUpdate({ blur: v })}
      />
      {e.type === "background-blur" ? (
        <PropertyNumberInput
          commitOnInput
          label="Saturation %"
          value={e.saturation ?? 100}
          instanceKey={`${instanceKey}-efx-${e.id}-sat`}
          disabled={disabled}
          min={0}
          max={200}
          onCommit={(v) => onUpdate({ saturation: v })}
        />
      ) : null}
    </div>
  );
}

function NoiseEffectFields({
  effect: e,
  instanceKey,
  disabled,
  onUpdate,
}: {
  effect: NodeEffect;
  instanceKey: string;
  disabled: boolean;
  onUpdate: (patch: Partial<NodeEffect>) => void;
}) {
  return (
    <div className="space-y-1.5">
      <InspectorLabelRow label="Type">
        <InspectorInsetSelect
          disabled={disabled}
          value={e.noiseMode ?? "monochrome"}
          onChange={(ev) => onUpdate({ noiseMode: ev.target.value as NoiseEffectMode })}
        >
          <option value="monochrome">Monochrome</option>
          <option value="color">Color</option>
        </InspectorInsetSelect>
      </InspectorLabelRow>
      <PropertyNumberInput
        commitOnInput
        label="Density %"
        value={Math.round((e.density ?? 0.35) * 100)}
        instanceKey={`${instanceKey}-efx-${e.id}-dens`}
        disabled={disabled}
        min={0}
        max={100}
        onCommit={(v) => onUpdate({ density: Math.min(1, Math.max(0, v / 100)) })}
      />
      <PropertyNumberInput
        commitOnInput
        label="Opacity %"
        value={Math.round((e.opacity ?? 0.4) * 100)}
        instanceKey={`${instanceKey}-efx-${e.id}-op`}
        disabled={disabled}
        min={0}
        max={100}
        onCommit={(v) => onUpdate({ opacity: Math.min(1, Math.max(0, v / 100)) })}
      />
      {(e.noiseMode ?? "monochrome") === "color" ? (
        <ColorInput
          variant="inspectorRow"
          hex={e.color ?? "#808080"}
          instanceKey={`${instanceKey}-efx-${e.id}-nc`}
          disabled={disabled}
          pickerTitle="Noise color"
          onCommitHex={(hex) => onUpdate({ color: hex })}
        />
      ) : null}
    </div>
  );
}

function TextureEffectFields({
  effect: e,
  instanceKey,
  disabled,
  onUpdate,
}: {
  effect: NodeEffect;
  instanceKey: string;
  disabled: boolean;
  onUpdate: (patch: Partial<NodeEffect>) => void;
}) {
  return (
    <div className="space-y-1.5">
      <PropertyNumberInput
        commitOnInput
        label="Scale"
        value={e.scale ?? 1}
        instanceKey={`${instanceKey}-efx-${e.id}-scale`}
        disabled={disabled}
        min={0.25}
        max={4}
        decimals={2}
        step={0.25}
        onCommit={(v) => onUpdate({ scale: v })}
      />
      <PropertyNumberInput
        commitOnInput
        label="Opacity %"
        value={Math.round((e.opacity ?? 0.25) * 100)}
        instanceKey={`${instanceKey}-efx-${e.id}-op`}
        disabled={disabled}
        min={0}
        max={100}
        onCommit={(v) => onUpdate({ opacity: Math.min(1, Math.max(0, v / 100)) })}
      />
      <InspectorLabelRow label="Blend">
        <InspectorInsetSelect
          disabled={disabled}
          value={e.blendMode ?? "overlay"}
          onChange={(ev) =>
            onUpdate({
              blendMode: ev.target.value as NodeEffect["blendMode"],
            })
          }
        >
          <option value="normal">Normal</option>
          <option value="overlay">Overlay</option>
          <option value="multiply">Multiply</option>
          <option value="soft-light">Soft light</option>
        </InspectorInsetSelect>
      </InspectorLabelRow>
    </div>
  );
}

function GlassEffectFields({
  effect: e,
  instanceKey,
  disabled,
  onUpdate,
}: {
  effect: NodeEffect;
  instanceKey: string;
  disabled: boolean;
  onUpdate: (patch: Partial<NodeEffect>) => void;
}) {
  return (
    <div className="space-y-1.5">
      <PropertyNumberInput
        commitOnInput
        label="Blur"
        value={e.blur ?? 16}
        instanceKey={`${instanceKey}-efx-${e.id}-blur`}
        disabled={disabled}
        min={0}
        max={256}
        onCommit={(v) => onUpdate({ blur: v })}
      />
      <PropertyNumberInput
        commitOnInput
        label="Fill %"
        value={Math.round((e.glassOpacity ?? 0.12) * 100)}
        instanceKey={`${instanceKey}-efx-${e.id}-gf`}
        disabled={disabled}
        min={0}
        max={100}
        onCommit={(v) => onUpdate({ glassOpacity: Math.min(1, Math.max(0, v / 100)) })}
      />
      <PropertyNumberInput
        commitOnInput
        label="Saturation %"
        value={e.saturation ?? 180}
        instanceKey={`${instanceKey}-efx-${e.id}-sat`}
        disabled={disabled}
        min={0}
        max={200}
        onCommit={(v) => onUpdate({ saturation: v })}
      />
      <PropertyNumberInput
        commitOnInput
        label="Border"
        value={e.borderWidth ?? 1}
        instanceKey={`${instanceKey}-efx-${e.id}-bw`}
        disabled={disabled}
        min={0}
        max={16}
        onCommit={(v) => onUpdate({ borderWidth: v })}
      />
      <ColorInput
        variant="inspectorRow"
        hex={e.borderColor ?? "#ffffff"}
        opacity={e.borderOpacity ?? 0.35}
        instanceKey={`${instanceKey}-efx-${e.id}-bc`}
        disabled={disabled}
        pickerTitle="Border color"
        onCommitHex={(hex) => onUpdate({ borderColor: hex })}
        onCommitOpacity={(opacity) => onUpdate({ borderOpacity: opacity })}
      />
      <PropertyNumberInput
        commitOnInput
        label="Light angle °"
        value={e.lightAngle ?? 135}
        instanceKey={`${instanceKey}-efx-${e.id}-la`}
        disabled={disabled}
        min={0}
        max={360}
        onCommit={(v) => onUpdate({ lightAngle: ((v % 360) + 360) % 360 })}
      />
    </div>
  );
}
