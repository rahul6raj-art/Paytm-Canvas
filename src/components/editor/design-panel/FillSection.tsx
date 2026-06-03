"use client";

import { PropertiesSection } from "../PropertiesSection";
import { ColorInput } from "../ColorInput";
import { ColorLibrary } from "../ColorLibrary";
import { GradientFillControls } from "../GradientFillControls";
import { InspectorSegmented } from "./InspectorPrimitives";
import { cn } from "@/lib/utils";
import { isColorValue, type ColorTokenValue, type DesignToken } from "@/lib/designTokens";
import type { FillGradient } from "@/lib/fillGradient";
import type { EditorNode, NodeStylePatch } from "@/stores/useEditorStore";

export function FillSection({
  node,
  display,
  instanceKey,
  locked,
  fillType,
  fillEnabled,
  fillOpacity,
  fillGradient,
  fillToken,
  linkedFillTokenType,
  designTokens,
  onStyle,
  onApplyGradient,
  onCreateColorToken,
  onCreateGradientToken,
  onDetachToken,
  onUpdateDesignToken,
  onBeginDrag,
}: {
  node: EditorNode;
  display: EditorNode;
  instanceKey: string;
  locked: boolean;
  fillType: "solid" | "gradient";
  fillEnabled: boolean;
  fillOpacity: number;
  fillGradient: FillGradient;
  fillToken: DesignToken | undefined;
  linkedFillTokenType: string | undefined;
  designTokens: Record<string, DesignToken>;
  onStyle: (p: NodeStylePatch) => void;
  onApplyGradient: (g: FillGradient, opts?: { skipHistory?: boolean }) => void;
  onCreateColorToken: () => void;
  onCreateGradientToken: () => void;
  onDetachToken: (kind: "color" | "gradient") => void;
  onUpdateDesignToken: (tokenId: string, patch: Partial<DesignToken>) => void;
  onBeginDrag: () => void;
}) {
  return (
    <PropertiesSection title="Fill" defaultOpen>
      <ColorLibrary variant="compact" className="mb-2" />
      {fillToken ? (
        <p className="mb-1.5 truncate text-[10px] text-app-muted">
          Style: <span className="font-medium text-app-fg">{fillToken.name}</span>
        </p>
      ) : null}
      <div className="mb-2 flex flex-wrap gap-1">
        <button
          type="button"
          disabled={locked || fillType === "gradient"}
          onClick={onCreateColorToken}
          className="rounded border border-app-border bg-app-panel px-2 py-0.5 text-[10px] font-medium text-app-fg hover:bg-app-hover disabled:opacity-40"
        >
          + Color style
        </button>
        <button
          type="button"
          disabled={locked || fillType !== "gradient"}
          onClick={onCreateGradientToken}
          className="rounded border border-app-border bg-app-panel px-2 py-0.5 text-[10px] font-medium text-app-fg hover:bg-app-hover disabled:opacity-40"
        >
          + Gradient style
        </button>
        {node.fillTokenId ? (
          <button
            type="button"
            disabled={locked}
            onClick={() => onDetachToken(linkedFillTokenType === "gradient" ? "gradient" : "color")}
            className="rounded border border-app-border bg-app-panel px-2 py-0.5 text-[10px] font-medium text-app-fg hover:bg-app-hover disabled:opacity-40"
          >
            Detach
          </button>
        ) : null}
      </div>
      {!node.fillTokenId ? (
        <InspectorSegmented
          options={[
            { value: "solid" as const, label: "Solid" },
            { value: "gradient" as const, label: "Gradient" },
          ]}
          value={fillType}
          disabled={locked || !fillEnabled}
          onChange={(t) => {
            if (t === "gradient") {
              onStyle({
                fillType: "gradient",
                fillGradient,
              });
            } else {
              onStyle({ fillType: "solid" });
            }
          }}
        />
      ) : null}
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-app-subtle">Visible</span>
        <button
          type="button"
          disabled={locked}
          onClick={() => onStyle({ fillEnabled: !fillEnabled })}
          className={cn(
            "rounded border px-2 py-0.5 text-[11px] font-medium transition-colors disabled:opacity-40",
            fillEnabled
              ? "border-accent/40 bg-accent/15 text-accent"
              : "border-app-border text-app-muted hover:bg-app-hover",
          )}
        >
          {fillEnabled ? "On" : "Off"}
        </button>
      </div>
      {fillType === "solid" && linkedFillTokenType !== "gradient" ? (
        <div className="mt-2 space-y-1.5">
          <ColorInput
            hex={display.fill ?? "#ffffff"}
            libraryName={fillToken?.name}
            libraryTokenId={node.fillTokenId}
            instanceKey={instanceKey}
            disabled={locked || !fillEnabled}
            onCommitHex={(hex) => {
              if (node.fillTokenId) {
                const t = designTokens[node.fillTokenId];
                if (t?.type === "color" && isColorValue(t.value)) {
                  onUpdateDesignToken(node.fillTokenId, {
                    value: { ...(t.value as ColorTokenValue), hex },
                  });
                  return;
                }
              }
              onStyle({ fill: hex, fillType: "solid" });
            }}
          />
          <div className="flex items-center gap-1.5">
            <span className="shrink-0 text-[11px] text-app-subtle">Opacity</span>
            <input
              type="text"
              disabled={locked || !fillEnabled}
              className="h-6 min-w-0 flex-1 rounded border border-app-border bg-app-field px-1.5 text-right text-[12px] text-app-field-fg disabled:opacity-40"
              value={`${Math.round(fillOpacity * 100)} %`}
              onChange={(e) => {
                const n = parseInt(e.target.value.replace(/%/g, ""), 10);
                if (!Number.isFinite(n)) return;
                const op = Math.min(100, Math.max(0, n)) / 100;
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
              }}
            />
          </div>
        </div>
      ) : null}
      {fillType === "gradient" ? (
        <div className="mt-2">
          <GradientFillControls
            gradient={fillGradient}
            fallbackFill={display.fill ?? node.fill}
            fillEnabled={fillEnabled}
            fillOpacity={fillOpacity}
            locked={locked}
            instanceKey={instanceKey}
            linkedStyleName={
              linkedFillTokenType === "gradient" && fillToken ? fillToken.name : undefined
            }
            onChange={onApplyGradient}
            onBeginDrag={onBeginDrag}
          />
        </div>
      ) : null}
    </PropertiesSection>
  );
}
