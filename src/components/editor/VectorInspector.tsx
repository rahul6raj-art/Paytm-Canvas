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
import { handlePanelFieldKeyDown, keyboardNudgeStep } from "@/lib/panelFieldKeyboard";
import {
  cornerRadiiStylePatch,
  isRoundedRectPath,
  pathPointCornerIndex,
  pathSupportsCornerRadius,
} from "@/lib/shapes/shapeToPath";
import { pathPointSelectionPosition } from "@/lib/pathEditAnchors";
import type { PathHandleMirroring } from "@/lib/pathHandles";
import { resolveNodeWithDesignTokens } from "@/lib/designTokens";
import { cn } from "@/lib/utils";
import {
  inspectorHeaderActionBtnClass,
  inspectorIconClass,
  inspectorIconStroke,
  inspectorLucideProps,
  inspectorRowActionBtnClass,
} from "@/lib/inspectorIconStyles";
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
  const selectedPathPointIds = useEditorStore((s) => s.selectedPathPointIds);
  const updatePathPoints = useEditorStore((s) => s.updatePathPoints);
  const canCornerRadius = pathSupportsCornerRadius(node);
  const rectLikePath = isRoundedRectPath(node);
  const focusedCornerIndex = canCornerRadius
    ? pathPointCornerIndex(node, selectedPathPointIds[0] ?? null)
    : null;
  const pathCornerLabels = useMemo(
    () => (node.pathPoints ?? []).map((_, i) => String(i + 1)),
    [node.pathPoints],
  );
  const anchorPos = pathPointSelectionPosition(node.pathPoints, selectedPathPointIds);

  const applyCornerStyle = (p: NodeStylePatch) => {
    if (!canCornerRadius) {
      style(p);
      return;
    }
    if (p.cornerRadii != null) {
      const patched = cornerRadiiStylePatch(node, p.cornerRadii);
      const explicitPerCorner =
        p.cornerRadius === undefined &&
        p.cornerRadii.length > 0 &&
        patched.cornerRadii == null;
      if (explicitPerCorner) {
        style({
          cornerRadius: undefined,
          cornerRadii: p.cornerRadii.map((r) => Math.max(0, r ?? 0)),
        });
        return;
      }
      style({ ...p, ...patched });
      return;
    }
    if (p.cornerRadius != null) {
      const count = (node.pathPoints ?? []).length;
      const radii = Array.from({ length: count }, () => p.cornerRadius ?? 0);
      style({ ...p, ...cornerRadiiStylePatch(node, radii) });
      return;
    }
    style(p);
  };

  return (
    <div className="pb-2">
      <div className="border-b border-app-panel-edge px-2 py-2">
        <h2 className="text-ui font-semibold text-app-fg">Vector</h2>
      </div>

      <PropertiesSection title="Alignment" defaultOpen>
        <AlignControls variant="panel" className="!space-y-1.5" />
      </PropertiesSection>

      <PropertiesSection title="Position" defaultOpen>
        <div className="grid grid-cols-2 gap-1.5">
          {anchorPos ? (
            <>
              <PropertyNumberInput
                commitOnInput={false}
                label="X"
                value={Math.round(anchorPos.x * 100) / 100}
                instanceKey={`${key}-apx-${selectedPathPointIds.join(",")}`}
                disabled={locked}
                decimals={2}
                onCommit={(v) => {
                  if (selectedPathPointIds.length === 1) {
                    updatePathPoints(id, { [selectedPathPointIds[0]!]: { x: v } });
                    return;
                  }
                  const delta = v - anchorPos.x;
                  const patches: Record<string, { x: number }> = {};
                  for (const pid of selectedPathPointIds) {
                    const pt = node.pathPoints?.find((p) => p.id === pid);
                    if (pt) patches[pid] = { x: pt.x + delta };
                  }
                  updatePathPoints(id, patches);
                }}
              />
              <PropertyNumberInput
                commitOnInput={false}
                label="Y"
                value={Math.round(anchorPos.y * 100) / 100}
                instanceKey={`${key}-apy-${selectedPathPointIds.join(",")}`}
                disabled={locked}
                decimals={2}
                onCommit={(v) => {
                  if (selectedPathPointIds.length === 1) {
                    updatePathPoints(id, { [selectedPathPointIds[0]!]: { y: v } });
                    return;
                  }
                  const delta = v - anchorPos.y;
                  const patches: Record<string, { y: number }> = {};
                  for (const pid of selectedPathPointIds) {
                    const pt = node.pathPoints?.find((p) => p.id === pid);
                    if (pt) patches[pid] = { y: pt.y + delta };
                  }
                  updatePathPoints(id, patches);
                }}
              />
            </>
          ) : (
            <>
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
            </>
          )}
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

      <PropertiesSection title="Corner radius" defaultOpen>
        <CornerRadiusControls
          node={node}
          instanceKey={`${key}-vec`}
          locked={locked || !canCornerRadius}
          focusedCornerIndex={focusedCornerIndex}
          focusedCornerLabel={
            focusedCornerIndex != null && !rectLikePath
              ? `Corner ${focusedCornerIndex + 1}`
              : undefined
          }
          cornerLabels={rectLikePath ? undefined : pathCornerLabels}
          onStyle={applyCornerStyle}
        />
      </PropertiesSection>

      <section className="border-b border-app-panel-edge px-2 py-2">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-ui font-semibold text-app-fg">Fill</span>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              title="Color styles"
              className={cn(inspectorHeaderActionBtnClass, "inspector-icon-btn")}
            >
              <Grid2x2 {...inspectorLucideProps()} />
            </button>
            <button
              type="button"
              title="Add fill"
              disabled={locked}
              className={cn(inspectorHeaderActionBtnClass, "inspector-icon-btn")}
              onClick={() => style({ fillEnabled: true, fill: fillHex, fillType: "solid" })}
            >
              <Plus {...inspectorLucideProps()} />
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
            className="h-6 min-w-0 flex-1 rounded border border-app-border bg-app-panel px-1.5 font-mono text-ui uppercase text-app-fg disabled:opacity-40"
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
              handlePanelFieldKeyDown(e, {
                onEnter: () => e.currentTarget.blur(),
              });
            }}
          />
          <input
            type="text"
            disabled={locked || !fillEnabled}
            className="h-6 w-12 shrink-0 rounded border border-app-border bg-app-panel px-1 text-center text-ui text-app-fg disabled:opacity-40"
            defaultValue={`${Math.round(fillOpacity * 100)} %`}
            key={`${key}-fo-${Math.round(fillOpacity * 100)}`}
            onBlur={(e) => {
              const v = parseInt(e.target.value.replace(/%/g, "").trim(), 10);
              if (Number.isFinite(v)) {
                style({ fillOpacity: Math.min(1, Math.max(0, v / 100)) });
              }
            }}
            onKeyDown={(e) => {
              handlePanelFieldKeyDown(e, {
                onEnter: () => e.currentTarget.blur(),
                onArrowNudge: (dir, shift, alt) => {
                  const step = keyboardNudgeStep(1, 0, shift, alt) * dir;
                  const v = parseInt(e.currentTarget.value.replace(/%/g, "").trim(), 10);
                  const base = Number.isFinite(v) ? v : Math.round(fillOpacity * 100);
                  const next = Math.min(100, Math.max(0, base + step));
                  e.currentTarget.value = `${next} %`;
                  style({ fillOpacity: next / 100 });
                },
              });
            }}
          />
          <button
            type="button"
            title={fillEnabled ? "Hide fill" : "Show fill"}
            disabled={locked}
            className={cn(inspectorRowActionBtnClass, "inspector-icon-btn")}
            onClick={() => style({ fillEnabled: !fillEnabled })}
          >
            {fillEnabled ? <Eye {...inspectorLucideProps()} /> : <EyeOff {...inspectorLucideProps()} />}
          </button>
          <button
            type="button"
            title="Remove fill"
            disabled={locked}
            className={cn(inspectorRowActionBtnClass, "inspector-icon-btn")}
            onClick={() => {
              pushHistory();
              style({ fillEnabled: false });
            }}
          >
            <Minus className={inspectorIconClass} strokeWidth={inspectorIconStroke} />
          </button>
        </div>
      </section>

      <section className="border-b border-app-panel-edge px-2 py-2">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-ui font-semibold text-app-fg">Stroke</span>
          {!hasStroke ? (
            <button
              type="button"
              title="Add stroke"
              disabled={locked}
              className={cn(inspectorHeaderActionBtnClass, "inspector-icon-btn")}
              onClick={() =>
                style({
                  strokeWidth: 1,
                  strokeColor: node.strokeColor ?? "#000000",
                  strokeStyle: node.strokeStyle ?? "solid",
                })
              }
            >
              <Plus {...inspectorLucideProps()} />
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
                className="h-6 min-w-0 flex-1 rounded border border-app-border bg-app-panel px-1.5 font-mono text-ui uppercase text-app-fg disabled:opacity-40"
                defaultValue={(node.strokeColor ?? "#000000").replace("#", "")}
                key={`${key}-sc-${node.strokeColor}`}
                onBlur={(e) => {
                  const n = normalizeHex(`#${e.target.value}`);
                  if (n) style({ strokeColor: n });
                }}
                onKeyDown={(e) => {
                  handlePanelFieldKeyDown(e, {
                    onEnter: () => e.currentTarget.blur(),
                  });
                }}
              />
              <input
                type="text"
                disabled={locked}
                className="h-6 w-10 shrink-0 rounded border border-app-border bg-app-panel px-1 text-center text-ui text-app-fg disabled:opacity-40"
                defaultValue={String(strokeWidth)}
                key={`${key}-sw-${strokeWidth}`}
                onBlur={(e) => {
                  const v = parseFloat(e.target.value);
                  if (Number.isFinite(v)) style({ strokeWidth: Math.min(64, Math.max(0, v)) });
                }}
                onKeyDown={(e) => {
                  handlePanelFieldKeyDown(e, {
                    onEnter: () => e.currentTarget.blur(),
                    onArrowNudge: (dir, shift, alt) => {
                      const step = keyboardNudgeStep(1, 0, shift, alt) * dir;
                      const v = parseFloat(e.currentTarget.value);
                      const base = Number.isFinite(v) ? v : strokeWidth;
                      const next = Math.min(64, Math.max(0, base + step));
                      e.currentTarget.value = String(next);
                      style({ strokeWidth: next });
                    },
                  });
                }}
              />
              <button
                type="button"
                title="Remove stroke"
                disabled={locked}
                className={cn(inspectorRowActionBtnClass, "inspector-icon-btn")}
                onClick={() => style({ strokeWidth: 0 })}
              >
                <Minus className={inspectorIconClass} strokeWidth={inspectorIconStroke} />
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
