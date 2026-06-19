"use client";

import { TextStyleSection } from "./TextStyleSection";
import type { EditorNode, NodeStylePatch } from "@/stores/useEditorStore";
import type { DesignToken } from "@/lib/designTokens";

export function TypographyMoreSettingsPanel({
  node,
  instanceKey,
  locked,
  designTokens,
  onStyle,
  onCreateTypographyToken,
  onCreateColorToken,
  onDetachTypographyToken,
  onDetachColorToken,
}: {
  node: EditorNode;
  instanceKey: string;
  locked: boolean;
  designTokens: Record<string, DesignToken>;
  onStyle: (p: NodeStylePatch) => void;
  onCreateTypographyToken: () => void;
  onCreateColorToken: () => void;
  onDetachTypographyToken: () => void;
  onDetachColorToken: () => void;
}) {
  return (
    <div className="space-y-3 p-3">
      {node.fillTokenId && designTokens[node.fillTokenId]?.type === "color" ? (
        <p className="truncate text-ui text-app-muted">
          Linked color:{" "}
          <span className="font-medium text-app-fg">{designTokens[node.fillTokenId]!.name}</span>
        </p>
      ) : null}

      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          disabled={locked}
          onClick={onCreateTypographyToken}
          className="rounded border border-app-border bg-app-panel px-2 py-0.5 text-ui font-medium text-app-fg hover:bg-app-hover disabled:opacity-40"
        >
          Create typography style
        </button>
        <button
          type="button"
          disabled={locked}
          onClick={onCreateColorToken}
          className="rounded border border-app-border bg-app-panel px-2 py-0.5 text-ui font-medium text-app-fg hover:bg-app-hover disabled:opacity-40"
        >
          Create color style
        </button>
        {node.textStyleTokenId ? (
          <button
            type="button"
            disabled={locked}
            onClick={onDetachTypographyToken}
            className="rounded border border-app-border bg-app-panel px-2 py-0.5 text-ui font-medium text-app-fg hover:bg-app-hover disabled:opacity-40"
          >
            Detach typography
          </button>
        ) : null}
        {node.fillTokenId ? (
          <button
            type="button"
            disabled={locked}
            onClick={onDetachColorToken}
            className="rounded border border-app-border bg-app-panel px-2 py-0.5 text-ui font-medium text-app-fg hover:bg-app-hover disabled:opacity-40"
          >
            Detach color
          </button>
        ) : null}
      </div>

      <div className="border-t border-app-border pt-2">
        <TextStyleSection
          node={node}
          instanceKey={instanceKey}
          locked={locked}
          onPatch={onStyle}
          includeAlignment={false}
        />
      </div>
    </div>
  );
}
