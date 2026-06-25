"use client";

import { useMemo, type ReactNode } from "react";
import {
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
import { EditorHintWrap } from "./EditorHoverHint";
import { InspectorHintIconButton } from "./design-panel/InspectorPrimitives";
import { FillSection } from "./design-panel/FillSection";

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
    <EditorHintWrap title={title} disabled={disabled}>
      <button
        type="button"
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
    </EditorHintWrap>
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
  const togglePathClosed = useEditorStore((s) => s.togglePathClosed);
  const detachTokenFromSelection = useEditorStore((s) => s.detachTokenFromSelection);
  const updateDesignToken = useEditorStore((s) => s.updateDesignToken);

  const display = useMemo(() => resolveNodeWithDesignTokens(node, designTokens), [node, designTokens]);
  const locked = node.locked;
  const id = node.id;
  const key = id;

  const patch = (p: Partial<EditorNode>) => updateNode(id, p);
  const style = (p: NodeStylePatch) => updateNodeStyle(id, p);

  const mirroring = node.pathHandleMirroring ?? "none";
  const fillEnabled = node.fillEnabled !== false;
  const fillOpacity = display.fillOpacity ?? 1;
  const fillToken = node.fillTokenId ? designTokens[node.fillTokenId] : undefined;
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
        <AlignControls variant="panel" />
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

      <PropertiesSection title="Path" defaultOpen>
        <div className="flex items-center justify-between gap-2">
          <span className="text-ui font-medium text-app-subtle">Closed path</span>
          <button
            type="button"
            disabled={locked}
            onClick={() => togglePathClosed(id)}
            className={cn(
              "rounded border px-2 py-0.5 text-ui font-medium transition-colors disabled:opacity-40",
              node.pathClosed
                ? "border-accent/40 bg-accent/15 text-accent"
                : "border-app-border text-app-muted hover:bg-app-hover",
            )}
          >
            {node.pathClosed ? "Closed" : "Open"}
          </button>
        </div>
        {!node.pathClosed ? (
          <p className="mt-1.5 inspector-helper-text text-app-subtle">
            Close the path to show fill on the canvas.
          </p>
        ) : null}
      </PropertiesSection>

      <FillSection
        node={node}
        display={display}
        instanceKey={key}
        locked={locked}
        fillEnabled={fillEnabled}
        fillOpacity={fillOpacity}
        fillToken={fillToken}
        designTokens={designTokens}
        onStyle={style}
        onDetachToken={(kind) => detachTokenFromSelection(kind)}
        onUpdateDesignToken={(tokenId, patch) => updateDesignToken(tokenId, patch)}
      />

      <section className="border-b border-app-panel-edge px-2 py-2">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-ui font-semibold text-app-fg">Stroke</span>
          {!hasStroke ? (
            <InspectorHintIconButton
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
            </InspectorHintIconButton>
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
              <InspectorHintIconButton
                title="Remove stroke"
                disabled={locked}
                className={cn(inspectorRowActionBtnClass, "inspector-icon-btn")}
                onClick={() => style({ strokeWidth: 0 })}
              >
                <Minus className={inspectorIconClass} strokeWidth={inspectorIconStroke} />
              </InspectorHintIconButton>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
