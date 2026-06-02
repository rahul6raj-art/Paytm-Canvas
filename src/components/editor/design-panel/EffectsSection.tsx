"use client";

import { useState } from "react";
import { Eye, EyeOff, Minus, Plus } from "lucide-react";
import { PropertiesSection } from "../PropertiesSection";
import { ColorInput } from "../ColorInput";
import { PropertyNumberInput } from "../PropertyInput";
import { InspectorLabelRow } from "./InspectorPrimitives";
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
import { cn } from "@/lib/utils";

const field =
  "h-6 min-h-[24px] w-full rounded border border-app-border bg-app-field px-1.5 text-[12px] text-app-field-fg focus-visible:border-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:opacity-40";

export function EffectsSection({
  instanceKey,
  locked,
  effects,
  effectToken,
  hasEffectToken,
  onAddEffect,
  onCreateEffectToken,
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
  onCreateEffectToken: () => void;
  onDetachEffectToken: () => void;
  onToggleEffect: (effectId: string) => void;
  onDeleteEffect: (effectId: string) => void;
  onUpdateEffect: (effectId: string, patch: Partial<NodeEffect>) => void;
  onChangeEffectType: (effectId: string, type: NodeEffectType) => void;
}) {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <PropertiesSection title="Effects" defaultOpen>
      {effectToken ? (
        <p className="mb-1.5 truncate text-[10px] text-app-muted">
          Style: <span className="font-medium text-app-fg">{effectToken.name}</span>
        </p>
      ) : null}
      <div className="mb-2 flex flex-wrap gap-1">
        <button
          type="button"
          disabled={locked}
          onClick={onCreateEffectToken}
          className="rounded border border-app-border bg-app-panel px-2 py-0.5 text-[10px] font-medium text-app-fg hover:bg-app-hover disabled:opacity-40"
        >
          + Effect style
        </button>
        {hasEffectToken ? (
          <button
            type="button"
            disabled={locked}
            onClick={onDetachEffectToken}
            className="rounded border border-app-border bg-app-panel px-2 py-0.5 text-[10px] font-medium text-app-fg hover:bg-app-hover disabled:opacity-40"
          >
            Detach
          </button>
        ) : null}
      </div>

      {effects.length === 0 ? (
        <p className="mb-2 text-[10px] text-app-subtle">No effects on this layer.</p>
      ) : (
        <ul className="mb-2 space-y-2">
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
      )}

      <div className="relative">
        <button
          type="button"
          disabled={locked}
          onClick={() => setAddOpen((o) => !o)}
          className="flex h-7 w-full items-center justify-center gap-1 rounded border border-app-border bg-app-panel text-[11px] font-medium text-app-fg hover:bg-app-hover disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2} />
          Add effect
        </button>
        {addOpen ? (
          <>
            <button
              type="button"
              className="fixed inset-0 z-10 cursor-default"
              aria-label="Close effect menu"
              onClick={() => setAddOpen(false)}
            />
            <ul className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-md border border-app-border bg-app-panel py-1 shadow-lg">
              {EFFECT_TYPE_OPTIONS.map((opt) => (
                <li key={opt.type}>
                  <button
                    type="button"
                    disabled={locked}
                    className="flex w-full px-3 py-1.5 text-left text-[12px] text-app-fg hover:bg-app-hover disabled:opacity-40"
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
          </>
        ) : null}
      </div>
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
    <li className="rounded border border-app-border bg-app-field p-1.5">
      <div className="mb-1.5 flex items-center gap-1">
        <select
          disabled={locked}
          className={cn(field, "min-w-0 flex-1 font-medium")}
          value={e.type}
          onChange={(ev) => onChangeType(ev.target.value as NodeEffectType)}
          aria-label="Effect type"
        >
          {EFFECT_TYPE_OPTIONS.map((opt) => (
            <option key={opt.type} value={opt.type}>
              {opt.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={locked}
          title={e.visible ? "Hide effect" : "Show effect"}
          onClick={onToggle}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-app-muted hover:bg-app-hover disabled:opacity-40"
        >
          {e.visible ? (
            <Eye className="h-3.5 w-3.5" strokeWidth={1.75} />
          ) : (
            <EyeOff className="h-3.5 w-3.5" strokeWidth={1.75} />
          )}
        </button>
        <button
          type="button"
          disabled={locked}
          onClick={onDelete}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-app-muted hover:bg-app-hover hover:text-rose-300 disabled:opacity-40"
          aria-label={`Remove ${effectTypeLabel(e.type)}`}
        >
          <Minus className="h-3.5 w-3.5" strokeWidth={2} />
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
      <div className="grid grid-cols-2 gap-1">
        <PropertyNumberInput
          commitOnInput
          label="X"
          value={e.x ?? 0}
          instanceKey={`${instanceKey}-efx-${e.id}-x`}
          disabled={disabled}
          onCommit={(v) => onUpdate({ x: v })}
        />
        <PropertyNumberInput
          commitOnInput
          label="Y"
          value={e.y ?? 0}
          instanceKey={`${instanceKey}-efx-${e.id}-y`}
          disabled={disabled}
          onCommit={(v) => onUpdate({ y: v })}
        />
        <PropertyNumberInput
          commitOnInput
          label="Blur"
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
          value={e.spread ?? 0}
          instanceKey={`${instanceKey}-efx-${e.id}-spread`}
          disabled={disabled}
          onCommit={(v) => onUpdate({ spread: v })}
        />
      </div>
      <ColorInput
        hex={e.color ?? "#000000"}
        instanceKey={`${instanceKey}-efx-${e.id}-c`}
        disabled={disabled}
        onCommitHex={(hex) => onUpdate({ color: hex })}
      />
      <PropertyNumberInput
        commitOnInput
        label="Opacity %"
        value={Math.round((e.opacity ?? 1) * 100)}
        instanceKey={`${instanceKey}-efx-${e.id}-op`}
        disabled={disabled}
        min={0}
        max={100}
        onCommit={(v) => onUpdate({ opacity: Math.min(1, Math.max(0, v / 100)) })}
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
        <select
          disabled={disabled}
          className={field}
          value={e.noiseMode ?? "monochrome"}
          onChange={(ev) => onUpdate({ noiseMode: ev.target.value as NoiseEffectMode })}
        >
          <option value="monochrome">Monochrome</option>
          <option value="color">Color</option>
        </select>
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
          hex={e.color ?? "#808080"}
          instanceKey={`${instanceKey}-efx-${e.id}-nc`}
          disabled={disabled}
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
        <select
          disabled={disabled}
          className={field}
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
        </select>
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
        hex={e.borderColor ?? "#ffffff"}
        instanceKey={`${instanceKey}-efx-${e.id}-bc`}
        disabled={disabled}
        onCommitHex={(hex) => onUpdate({ borderColor: hex })}
      />
      <PropertyNumberInput
        commitOnInput
        label="Border opacity %"
        value={Math.round((e.borderOpacity ?? 0.35) * 100)}
        instanceKey={`${instanceKey}-efx-${e.id}-bo`}
        disabled={disabled}
        min={0}
        max={100}
        onCommit={(v) => onUpdate({ borderOpacity: Math.min(1, Math.max(0, v / 100)) })}
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
