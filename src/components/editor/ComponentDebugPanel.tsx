"use client";

import { useMemo } from "react";
import { useEditorStore } from "@/stores/useEditorStore";
import { findInstanceRoot } from "@/lib/componentModel";
import { buildComponentDebugInfo } from "@/lib/components/debug";
import { PropertiesSection } from "@/components/editor/PropertiesSection";

type Props = {
  nodeId: string;
};

export function ComponentDebugPanel({ nodeId }: Props) {
  const nodes = useEditorStore((s) => s.nodes);
  const childOrder = useEditorStore((s) => s.childOrder);
  const instRootId = findInstanceRoot(nodes, nodeId);

  const debug = useMemo(() => {
    if (!instRootId) return null;
    return buildComponentDebugInfo(nodes, childOrder, instRootId);
  }, [nodes, childOrder, instRootId]);

  if (!debug || process.env.NODE_ENV === "production") return null;

  return (
    <PropertiesSection title="Component debug" defaultOpen={false}>
      <dl className="space-y-1.5 font-mono text-[10px] leading-relaxed text-app-muted">
        <Row label="instance id" value={debug.instanceRootId} />
        <Row label="component id" value={debug.componentId} />
        <Row label="master id" value={debug.masterNodeId} />
        <Row label="master version" value={String(debug.masterVersion)} />
        <Row label="instance version" value={String(debug.instanceComponentVersion)} />
        <Row label="cache" value={debug.cacheStatus} />
        <Row label="stale" value={debug.stale ? "yes" : "fresh"} />
        <Row label="source" value={debug.resolvedTreeSource} />
        {debug.lastPropagationReason ? (
          <Row label="last propagation" value={debug.lastPropagationReason} />
        ) : null}
        {debug.layoutInvalidationReason ? (
          <Row label="layout invalidation" value={debug.layoutInvalidationReason} />
        ) : null}
        {debug.changedStableIds?.length ? (
          <Row label="changed stable ids" value={debug.changedStableIds.join(", ")} />
        ) : null}
        {debug.nestedDependencyPath?.length ? (
          <Row label="cascade path" value={debug.nestedDependencyPath.join(" → ")} />
        ) : null}
        <Row label="applied overrides" value={String(debug.appliedOverrideCount)} />
        {debug.droppedOverrides.length > 0 ? (
          <Row label="dropped overrides" value={debug.droppedOverrides.join(", ")} />
        ) : null}
        {debug.selectedVariant ? (
          <Row label="variant" value={JSON.stringify(debug.selectedVariant)} />
        ) : null}
        {Object.keys(debug.componentPropertyValues).length > 0 ? (
          <Row label="properties" value={JSON.stringify(debug.componentPropertyValues)} />
        ) : null}
        {Object.keys(debug.overrideMap).length > 0 ? (
          <div>
            <dt className="text-app-subtle">local overrides</dt>
            <dd className="mt-0.5 whitespace-pre-wrap break-all text-app-fg">
              {JSON.stringify(debug.overrideMap, null, 2)}
            </dd>
          </div>
        ) : null}
        {debug.matchedLayers.length > 0 ? (
          <div>
            <dt className="text-app-subtle">stable id map ({debug.matchedLayers.length})</dt>
            <dd className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-all text-app-fg">
              {debug.matchedLayers
                .map((m) => `${m.stableId} → inst:${m.instanceNodeId} master:${m.masterNodeId}`)
                .join("\n")}
            </dd>
          </div>
        ) : null}
      </dl>
    </PropertiesSection>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-app-subtle">{label}</dt>
      <dd className="min-w-0 break-all text-app-fg">{value}</dd>
    </div>
  );
}
