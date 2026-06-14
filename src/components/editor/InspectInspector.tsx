"use client";

import { useCallback, useMemo, useState } from "react";
import type { EditorNode } from "@/stores/useEditorStore";
import { useEditorStore } from "@/stores/useEditorStore";
import { worldRect } from "@/lib/tree";
import {
  downloadNodePng,
  downloadNodePdf,
  saveTextWithDialog,
  nearestAncestorFrameId,
  nodeToCss,
  nodeToSvg,
  nodeToTailwind,
  pngExportFilename,
} from "@/lib/inspectExport";
import { InspectorExportSection } from "./design-panel/InspectorExportSection";
import { cn } from "@/lib/utils";

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

function CodeBlock({ title, code }: { title: string; code: string }) {
  return (
    <div className="rounded-md border border-app-border bg-app-surface shadow-inner">
      <div className="border-b border-app-panel-edge px-2 py-1 section-heading">
        {title}
      </div>
      <pre className="thin-scroll max-h-[140px] overflow-auto p-2 font-mono text-ui leading-snug text-app-fg">
        {code}
      </pre>
    </div>
  );
}

function CopyRow({
  label,
  text,
  copiedKey,
  setCopiedKey,
  copyKey,
}: {
  label: string;
  text: string;
  copiedKey: string | null;
  setCopiedKey: (k: string | null) => void;
  copyKey: string;
}) {
  const copied = copiedKey === copyKey;
  const onCopy = useCallback(async () => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedKey(copyKey);
      window.setTimeout(() => setCopiedKey(null), 1600);
    }
  }, [copyKey, setCopiedKey, text]);

  return (
    <button
      type="button"
      onClick={onCopy}
      className={cn(
        "flex h-7 w-full items-center justify-center rounded-md border text-ui font-medium transition-colors",
        copied
          ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
          : "border-white/10 bg-app-hover text-app-fg hover:border-white/20 hover:bg-white/[0.07]",
      )}
    >
      {copied ? "Copied" : label}
    </button>
  );
}

export function InspectInspector({ node }: { node: EditorNode }) {
  const nodes = useEditorStore((s) => s.nodes);
  const childOrder = useEditorStore((s) => s.childOrder);
  const assets = useEditorStore((s) => s.assets);
  const designTokens = useEditorStore((s) => s.designTokens);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState<"png" | "svg" | "pdf" | null>(null);
  const [pngScale, setPngScale] = useState(1);

  const parentFrameId = useMemo(() => nearestAncestorFrameId(nodes, node.id), [nodes, node.id]);
  const parentLabel = parentFrameId ? (nodes[parentFrameId]?.name ?? parentFrameId) : "—";

  const wr = useMemo(() => worldRect(node.id, nodes), [node.id, nodes]);
  const css = useMemo(() => nodeToCss(node, designTokens), [node, designTokens]);
  const tw = useMemo(() => nodeToTailwind(node, designTokens), [node, designTokens]);
  const svg = useMemo(() => nodeToSvg(node, nodes, childOrder, assets, designTokens), [node, nodes, childOrder, assets, designTokens]);

  const safeName = (node.name || "layer").replace(/[^\w\-]+/g, "-").slice(0, 48);

  const onExportSvg = useCallback(async () => {
    setExportBusy("svg");
    try {
      await saveTextWithDialog(`${safeName}.svg`, svg, "image/svg+xml;charset=utf-8", {
        description: "SVG image",
        mimeType: "image/svg+xml",
        extension: ".svg",
      });
    } finally {
      setExportBusy(null);
    }
  }, [safeName, svg]);

  const onExportPng = useCallback(async () => {
    setExportBusy("png");
    try {
      await downloadNodePng(
        node,
        nodes,
        childOrder,
        pngExportFilename(`${safeName}.png`, pngScale),
        assets,
        designTokens,
        pngScale,
      );
    } finally {
      setExportBusy(null);
    }
  }, [assets, childOrder, designTokens, node, nodes, pngScale, safeName]);

  const onExportPdf = useCallback(async () => {
    setExportBusy("pdf");
    try {
      await downloadNodePdf(node, nodes, childOrder, `${safeName}.pdf`, assets, designTokens);
    } finally {
      setExportBusy(null);
    }
  }, [assets, childOrder, designTokens, node, nodes, safeName]);

  return (
    <div className="space-y-3 p-3 text-ui leading-snug text-app-fg">
      <div>
        <h2 className="truncate text-ui-sm font-semibold text-white">{node.name}</h2>
        <p className="mt-0.5 text-ui capitalize text-app-subtle">{node.type}</p>
      </div>

      <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 rounded-md border border-app-border-subtle bg-app-panel p-2 font-mono text-ui">
        <span className="text-app-subtle">Position</span>
        <span className="text-right text-app-fg">
          X {Math.round(node.x)} · Y {Math.round(node.y)}
        </span>
        <span className="text-app-subtle">Size</span>
        <span className="text-right text-app-fg">
          W {Math.round(node.width)} · H {Math.round(node.height)}
        </span>
        <span className="text-app-subtle">World</span>
        <span className="text-right text-app-fg">
          {Math.round(wr.x)}, {Math.round(wr.y)}
        </span>
        <span className="text-app-subtle">Rotation</span>
        <span className="text-right text-app-fg">{node.rotation ?? 0}°</span>
        <span className="text-app-subtle">Parent frame</span>
        <span className="truncate text-right text-app-fg" title={parentFrameId ?? ""}>
          {parentLabel}
        </span>
        <span className="text-app-subtle">Visible</span>
        <span className="text-right text-app-fg">{node.visible ? "Yes" : "No"}</span>
        <span className="text-app-subtle">Locked</span>
        <span className="text-right text-app-fg">{node.locked ? "Yes" : "No"}</span>
      </div>

      <div className="space-y-1.5">
        <p className="section-heading">CSS</p>
        <CodeBlock title="Generated" code={css} />
        <CopyRow
          label="Copy CSS"
          text={css}
          copiedKey={copiedKey}
          setCopiedKey={setCopiedKey}
          copyKey="css"
        />
      </div>

      <div className="space-y-1.5">
        <p className="section-heading">Tailwind</p>
        <CodeBlock title="Classes" code={tw} />
        <CopyRow
          label="Copy Tailwind"
          text={tw}
          copiedKey={copiedKey}
          setCopiedKey={setCopiedKey}
          copyKey="tw"
        />
      </div>

      <div className="space-y-1.5">
        <p className="section-heading">Export</p>
        <InspectorExportSection
          variant="inspect"
          exportBusy={exportBusy}
          pngScale={pngScale}
          onPngScaleChange={setPngScale}
          onExportPng={onExportPng}
          onExportSvg={onExportSvg}
          onExportPdf={onExportPdf}
        />
      </div>
    </div>
  );
}
