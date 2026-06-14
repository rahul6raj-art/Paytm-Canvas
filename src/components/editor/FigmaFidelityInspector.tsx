"use client";

import { useMemo } from "react";
import type { EditorNode } from "@/stores/useEditorStore";
import { useEditorStore } from "@/stores/useEditorStore";
import type { FidelityMismatch, NodeFidelityReport } from "@/lib/figImport/figFidelityTypes";
import { cn } from "@/lib/utils";

function scoreColor(score: number): string {
  if (score >= 90) return "text-emerald-600";
  if (score >= 70) return "text-amber-600";
  return "text-red-600";
}

function MismatchRow({ m }: { m: FidelityMismatch }) {
  return (
    <div className="rounded border border-app-border/80 bg-app-surface/60 px-2 py-1.5 text-ui">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-app-fg">{m.field}</span>
        <span className="rounded bg-app-muted px-1 font-mono text-[10px] text-app-muted-fg">
          {m.engine}
        </span>
      </div>
      <p className="mt-0.5 text-app-muted-fg">{m.message}</p>
      {m.delta && (
        <p className="mt-0.5 font-mono text-[10px] text-red-600">delta: {m.delta}</p>
      )}
    </div>
  );
}

function NodeReport({ report }: { report: NodeFidelityReport }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-ui font-semibold text-app-fg">{report.nodeName}</span>
        <span className={cn("font-mono text-ui font-bold", scoreColor(report.fidelityScore))}>
          {report.fidelityScore}%
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 font-mono text-[10px] text-app-muted-fg">
        <div>
          <div className="font-semibold text-blue-600">Figma</div>
          <div>
            {report.figBounds.x}, {report.figBounds.y} · {report.figBounds.width}×
            {report.figBounds.height}
          </div>
        </div>
        <div>
          <div className="font-semibold text-orange-600">Canvas</div>
          <div>
            {report.canvasBounds.x}, {report.canvasBounds.y} · {report.canvasBounds.width}×
            {report.canvasBounds.height}
          </div>
        </div>
      </div>
      {report.mismatches.length === 0 ? (
        <p className="text-ui text-emerald-600">No mismatches</p>
      ) : (
        <div className="max-h-[240px] space-y-1.5 overflow-y-auto thin-scroll">
          {report.mismatches.map((m, i) => (
            <MismatchRow key={`${m.field}-${i}`} m={m} />
          ))}
        </div>
      )}
    </div>
  );
}

export function FigmaFidelityInspector({ node }: { node: EditorNode }) {
  const report = useEditorStore((s) => s.figFidelityReport);
  const overlayEnabled = useEditorStore((s) => s.figFidelityOverlayEnabled);
  const setOverlay = useEditorStore((s) => s.setFigFidelityOverlayEnabled);
  const refresh = useEditorStore((s) => s.refreshFigFidelityReport);

  const nodeReport = useMemo(
    () => report?.nodes.find((n) => n.nodeId === node.id) ?? null,
    [node.id, report],
  );

  if (!report) return null;

  const engines = Object.entries(report.engineBreakdown)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-3 border-t border-app-border pt-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="section-heading text-app-fg">Figma fidelity</h3>
        <span className={cn("font-mono text-ui font-bold", scoreColor(report.fidelityScore))}>
          {report.fidelityScore}%
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
        <div className="rounded border border-app-border bg-app-surface p-1.5">
          <div className="font-semibold text-app-fg">{report.totalNodes}</div>
          <div className="text-app-muted-fg">nodes</div>
        </div>
        <div className="rounded border border-app-border bg-app-surface p-1.5">
          <div className="font-semibold text-emerald-600">{report.matchedNodes}</div>
          <div className="text-app-muted-fg">matched</div>
        </div>
        <div className="rounded border border-app-border bg-app-surface p-1.5">
          <div className="font-semibold text-red-600">{report.mismatchedNodes}</div>
          <div className="text-app-muted-fg">mismatch</div>
        </div>
      </div>

      {engines.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-app-muted-fg">
            Divergence by engine
          </div>
          {engines.map(([engine, count]) => (
            <div key={engine} className="flex justify-between font-mono text-ui">
              <span className="capitalize text-app-fg">{engine}</span>
              <span className="text-app-muted-fg">{count}</span>
            </div>
          ))}
        </div>
      )}

      {report.unsupportedFeatures.length > 0 && (
        <div className="rounded border border-amber-500/30 bg-amber-500/5 p-2 text-ui text-amber-800 dark:text-amber-200">
          <div className="font-semibold">Unsupported in import</div>
          <ul className="mt-1 list-inside list-disc text-[11px]">
            {report.unsupportedFeatures.slice(0, 6).map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          className={cn(
            "flex-1 rounded border px-2 py-1 text-ui",
            overlayEnabled
              ? "border-blue-500 bg-blue-500/10 text-blue-700"
              : "border-app-border text-app-muted-fg",
          )}
          onClick={() => setOverlay(!overlayEnabled)}
        >
          {overlayEnabled ? "Hide bounds overlay" : "Show bounds overlay"}
        </button>
        <button
          type="button"
          className="rounded border border-app-border px-2 py-1 text-ui text-app-muted-fg"
          onClick={() => refresh()}
        >
          Refresh
        </button>
      </div>

      {nodeReport ? (
        <NodeReport report={nodeReport} />
      ) : (
        <p className="text-ui text-app-muted-fg">No fidelity data for this layer.</p>
      )}
    </div>
  );
}
