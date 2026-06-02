"use client";

import { useMemo, type ReactNode } from "react";
import {
  Eye,
  EyeOff,
  Grid2x2,
  Minus,
  Plus,
} from "lucide-react";
import { normalizeHex } from "@/lib/color";
import {
  cornerRadiiStylePatch,
  pathPointCornerIndex,
  pathSupportsCornerRadius,
} from "@/lib/shapes/shapeToPath";
import type { PathHandleMirroring } from "@/lib/pathHandles";
import { getNodeCornerRadii } from "@/lib/cornerRadius";
import { resolveNodeWithDesignTokens } from "@/lib/designTokens";
import { cn } from "@/lib/utils";
import type { EditorNode, NodeStylePatch } from "@/stores/useEditorStore";
import { useEditorStore } from "@/stores/useEditorStore";
import { AlignControls } from "./AlignControls";
import { CornerRadiusControls } from "./CornerRadiusControls";
import { PropertyNumberInput } from "./PropertyInput";
import { PropertiesSection } from "./PropertiesSection";

function MirroringButton({
  mode,
  active,
  disabled,
  title,
  onClick,
  children,
}: {
  mode: PathHandleMirroring;
  active: boolean;
  disabled?: boolean;
  title: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      data-mirroring={mode}
      onClick={onClick}
      className={cn(
        "flex h-7 flex-1 items-center justify-center rounded border transition-colors disabled:opacity-40",
        active
          ? "border-app-border bg-app-toolbar-well text-app-fg"
          : "border-transparent text-app-muted hover:bg-app-hover hover:text-app-fg",
      )}
    >
      {children}
    </button>
  );
}

function MirroringIconNone() {
  return (
    <svg width="28" height="16" viewBox="0 0 28 16" aria-hidden className="text-app-muted">
      <circle cx="6" cy="12" r="2" fill="currentColor" />
      <path d="M6 12 L18 4" stroke="currentColor" strokeWidth="1.25" fill="none" />
      <path d="M6 12 L20 14" stroke="currentColor" strokeWidth="1.25" fill="none" />
    </svg>
  );
}

function MirroringIconAngle() {
  return (
    <svg width="28" height="16" viewBox="0 0 28 16" aria-hidden className="text-app-muted">
      <circle cx="14" cy="8" r="2" fill="currentColor" />
      <path d="M4 8 L24 8" stroke="currentColor" strokeWidth="1.25" fill="none" />
      <path d="M14 8 L22 3" stroke="currentColor" strokeWidth="1.25" fill="none" />
      <path d="M14 8 L22 13" stroke="currentColor" strokeWidth="1.25" fill="none" />
    </svg>
  );
}

function MirroringIconAngleLength() {
  return (
    <svg width="28" height="16" viewBox="0 0 28 16" aria-hidden className="text-app-muted">
      <circle cx="14" cy="8" r="2" fill="currentColor" />
      <path d="M5 8 L23 8" stroke="currentColor" strokeWidth="1.25" fill="none" />
      <path d="M14 8 L23 3" stroke="currentColor" strokeWidth="1.25" fill="none" />
      <path d="M14 8 L23 13" stroke="currentColor" strokeWidth="1.25" fill="none" />
    </svg>
  );
}

export function VectorInspector({ node }: { node: EditorNode }) {
  const designTokens = useEditorStore((s) => s.designTokens);
  const updateNode = useEditorStore((s) => s.updateNode);
  const updateNodeStyle = useEditorStore((s) => s.updateNodeStyle);
  const setPathHandleMirroring = useEditorStore((s) => s.setPathHandleMirroring);
  const pushHistory = useEditorStore((s) => s.pushHistory);

  const display = useMemo(() => resolveNodeWithDesignTokens(node, designTokens), [node, designTokens]);
  const locked = node.locked;
  const id = node.id;
  const key = id;

  const patch = (p: Partial<EditorNode>) => updateNode(id, p);
  const style = (p: NodeStylePatch) => updateNodeStyle(id, p);

  const mirroring = node.pathHandleMirroring ?? "none";
  const fillEnabled = node.fillEnabled !== false;
  const fillHex = normalizeHex(display.fill ?? "#d9d9d9") ?? "#d9d9d9";
  const fillOpacity = display.fillOpacity ?? 1;
  const strokeWidth = node.strokeWidth ?? 0;
  const hasStroke = strokeWidth > 0;
  const selectedPathPointId = useEditorStore((s) => s.selectedPathPointId);
  const canCornerRadius = pathSupportsCornerRadius(node);
  const focusedCornerIndex = canCornerRadius
    ? pathPointCornerIndex(node, selectedPathPointId)
    : null;

  const applyCornerStyle = (p: NodeStylePatch) => {
    if (!canCornerRadius) {
      style(p);
      return;
    }
    const radii = getNodeCornerRadii({ ...node, ...p });
    style({ ...p, ...cornerRadiiStylePatch(node, radii) });
  };

  return (
    <div className="pb-2">
      <div className="border-b border-app-border-subtle px-2 py-2">
        <h2 className="text-[12px] font-semibold text-app-fg">Vector</h2>
      </div>

      <PropertiesSection title="Alignment" defaultOpen>
        <AlignControls variant="panel" className="!space-y-1.5" />
      </PropertiesSection>

      <PropertiesSection title="Position" defaultOpen>
        <div className="grid grid-cols-2 gap-1.5">
          <PropertyNumberInput
            commitOnInput={false}
            label="X"
            value={Math.round(node.x * 100) / 100}
            instanceKey={`${key}-vx`}
            disabled={locked}
            decimals={2}
            onCommit={(v) => patch({ x: v })}
          />
          <PropertyNumberInput
            commitOnInput={false}
            label="Y"
            value={Math.round(node.y * 100) / 100}
            instanceKey={`${key}-vy`}
            disabled={locked}
            decimals={2}
            onCommit={(v) => patch({ y: v })}
          />
        </div>
      </PropertiesSection>

      <PropertiesSection title="Mirroring" defaultOpen>
        <div className="flex gap-0.5 rounded border border-app-border bg-app-panel p-0.5">
          <MirroringButton
            mode="none"
            active={mirroring === "none"}
            disabled={locked}
            title="No mirroring"
            onClick={() => setPathHandleMirroring("none")}
          >
            <MirroringIconNone />
          </MirroringButton>
          <MirroringButton
            mode="angle"
            active={mirroring === "angle"}
            disabled={locked}
            title="Mirror angle"
            onClick={() => setPathHandleMirroring("angle")}
          >
            <MirroringIconAngle />
          </MirroringButton>
          <MirroringButton
            mode="angle-length"
            active={mirroring === "angle-length"}
            disabled={locked}
            title="Mirror angle and length"
            onClick={() => setPathHandleMirroring("angle-length")}
          >
            <MirroringIconAngleLength />
          </MirroringButton>
        </div>
      </PropertiesSection>

      {canCornerRadius ? (
        <PropertiesSection title="Corner radius" defaultOpen>
          <CornerRadiusControls
            node={node}
            instanceKey={`${key}-vec`}
            locked={locked}
            focusedCornerIndex={focusedCornerIndex}
            onStyle={applyCornerStyle}
          />
        </PropertiesSection>
      ) : null}

      <section className="border-b border-app-border-subtle px-2 py-2">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[11px] font-semibold text-app-fg">Fill</span>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              title="Color styles"
              className="flex h-6 w-6 items-center justify-center rounded text-app-muted hover:bg-app-hover hover:text-app-fg"
            >
              <Grid2x2 className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
            <button
              type="button"
              title="Add fill"
              disabled={locked}
              className="flex h-6 w-6 items-center justify-center rounded text-app-muted hover:bg-app-hover hover:text-app-fg disabled:opacity-40"
              onClick={() => style({ fillEnabled: true, fill: fillHex, fillType: "solid" })}
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={locked}
            className="h-6 w-6 shrink-0 rounded border border-app-border"
            style={{ backgroundColor: fillEnabled ? fillHex : "transparent" }}
            aria-label="Fill color"
            onClick={() => {
              const input = document.createElement("input");
              input.type = "color";
              input.value = fillHex;
              input.onchange = () => {
                const n = normalizeHex(input.value);
                if (n) style({ fill: n, fillType: "solid", fillEnabled: true });
              };
              input.click();
            }}
          />
          <input
            type="text"
            disabled={locked || !fillEnabled}
            className="h-6 min-w-0 flex-1 rounded border border-app-border bg-app-panel px-1.5 font-mono text-[11px] uppercase text-app-fg disabled:opacity-40"
            value={fillHex.replace("#", "")}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^0-9a-f]/gi, "").slice(0, 6);
              e.target.value = raw;
            }}
            onBlur={(e) => {
              const n = normalizeHex(`#${e.target.value}`);
              if (n) style({ fill: n, fillType: "solid", fillEnabled: true });
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
          <input
            type="text"
            disabled={locked || !fillEnabled}
            className="h-6 w-12 shrink-0 rounded border border-app-border bg-app-panel px-1 text-center text-[11px] text-app-fg disabled:opacity-40"
            defaultValue={`${Math.round(fillOpacity * 100)} %`}
            key={`${key}-fo-${Math.round(fillOpacity * 100)}`}
            onBlur={(e) => {
              const v = parseInt(e.target.value.replace(/%/g, "").trim(), 10);
              if (Number.isFinite(v)) {
                style({ fillOpacity: Math.min(1, Math.max(0, v / 100)) });
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
          <button
            type="button"
            title={fillEnabled ? "Hide fill" : "Show fill"}
            disabled={locked}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-app-muted hover:bg-app-hover hover:text-app-fg disabled:opacity-40"
            onClick={() => style({ fillEnabled: !fillEnabled })}
          >
            {fillEnabled ? (
              <Eye className="h-3.5 w-3.5" strokeWidth={1.75} />
            ) : (
              <EyeOff className="h-3.5 w-3.5" strokeWidth={1.75} />
            )}
          </button>
          <button
            type="button"
            title="Remove fill"
            disabled={locked}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-app-muted hover:bg-app-hover hover:text-app-fg disabled:opacity-40"
            onClick={() => {
              pushHistory();
              style({ fillEnabled: false });
            }}
          >
            <Minus className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>
        </div>
      </section>

      <section className="border-b border-app-border-subtle px-2 py-2">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[11px] font-semibold text-app-fg">Stroke</span>
          {!hasStroke ? (
            <button
              type="button"
              title="Add stroke"
              disabled={locked}
              className="flex h-6 w-6 items-center justify-center rounded text-app-muted hover:bg-app-hover hover:text-app-fg disabled:opacity-40"
              onClick={() =>
                style({
                  strokeWidth: 1,
                  strokeColor: node.strokeColor ?? "#000000",
                  strokeStyle: node.strokeStyle ?? "solid",
                })
              }
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
          ) : null}
        </div>
        {hasStroke ? (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={locked}
                className="h-6 w-6 shrink-0 rounded border border-app-border"
                style={{ backgroundColor: node.strokeColor ?? "#000000" }}
                aria-label="Stroke color"
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "color";
                  input.value = normalizeHex(node.strokeColor ?? "#000000") ?? "#000000";
                  input.onchange = () => {
                    const n = normalizeHex(input.value);
                    if (n) style({ strokeColor: n });
                  };
                  input.click();
                }}
              />
              <input
                type="text"
                disabled={locked}
                className="h-6 min-w-0 flex-1 rounded border border-app-border bg-app-panel px-1.5 font-mono text-[11px] uppercase text-app-fg disabled:opacity-40"
                defaultValue={(node.strokeColor ?? "#000000").replace("#", "")}
                key={`${key}-sc-${node.strokeColor}`}
                onBlur={(e) => {
                  const n = normalizeHex(`#${e.target.value}`);
                  if (n) style({ strokeColor: n });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
              />
              <input
                type="text"
                disabled={locked}
                className="h-6 w-10 shrink-0 rounded border border-app-border bg-app-panel px-1 text-center text-[11px] text-app-fg disabled:opacity-40"
                defaultValue={String(strokeWidth)}
                key={`${key}-sw-${strokeWidth}`}
                onBlur={(e) => {
                  const v = parseFloat(e.target.value);
                  if (Number.isFinite(v)) style({ strokeWidth: Math.min(64, Math.max(0, v)) });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
              />
              <button
                type="button"
                title="Remove stroke"
                disabled={locked}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-app-muted hover:bg-app-hover hover:text-app-fg disabled:opacity-40"
                onClick={() => style({ strokeWidth: 0 })}
              >
                <Minus className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
