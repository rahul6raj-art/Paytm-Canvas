"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useEditorStore, ROOT, type EditorNode } from "@/stores/useEditorStore";
import { CanvasObject } from "./CanvasObject";
import { worldRect, pickDeepestVisibleNodeAtWorldPoint } from "@/lib/tree";
import type { PrototypeLink } from "@/lib/prototype";

function findClickLinkAlongChain(
  nodes: Record<string, EditorNode>,
  startId: string | null,
): PrototypeLink | null {
  let cur: string | null = startId;
  while (cur) {
    const links = nodes[cur]?.prototypeLinks ?? [];
    const hit = links.find((l) => l.trigger === "click");
    if (hit) return hit;
    cur = nodes[cur]?.parentId ?? null;
  }
  return null;
}

function findHoverLinkAlongChain(
  nodes: Record<string, EditorNode>,
  startId: string | null,
): PrototypeLink | null {
  let cur: string | null = startId;
  while (cur) {
    const links = nodes[cur]?.prototypeLinks ?? [];
    const hit = links.find((l) => l.trigger === "hover");
    if (hit) return hit;
    cur = nodes[cur]?.parentId ?? null;
  }
  return null;
}

export function PrototypePreviewModal() {
  const prototypePreview = useEditorStore((s) => s.prototypePreview);
  const nodes = useEditorStore((s) => s.nodes);
  const childOrder = useEditorStore((s) => s.childOrder);
  const closePrototypePreview = useEditorStore((s) => s.closePrototypePreview);
  const navigatePrototype = useEditorStore((s) => s.navigatePrototype);
  const prototypePreviewBack = useEditorStore((s) => s.prototypePreviewBack);

  const clipRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [transitionKind, setTransitionKind] = useState<"instant" | "dissolve" | "slide-left" | "slide-right">(
    "instant",
  );
  const [displayTick, setDisplayTick] = useState(0);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastHoverFire = useRef<string | null>(null);
  const prevPreviewRef = useRef(prototypePreview);

  useEffect(() => {
    if (prototypePreview && !prevPreviewRef.current) setTransitionKind("instant");
    prevPreviewRef.current = prototypePreview;
  }, [prototypePreview]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const pv = prototypePreview;
  const mainFrameId = pv?.mainFrameId ?? null;
  const overlayFrameId = pv?.overlayFrameId ?? null;

  const activeFrameId = overlayFrameId ?? mainFrameId;
  const wr = useMemo(
    () => (activeFrameId ? worldRect(activeFrameId, nodes) : null),
    [activeFrameId, nodes],
  );

  const applyLink = useCallback(
    (link: PrototypeLink) => {
      if (link.action === "back") {
        prototypePreviewBack();
        setTransitionKind(link.transition);
        setDisplayTick((t) => t + 1);
        return;
      }
      const target = link.targetFrameId;
      if (!target || nodes[target]?.type !== "frame") return;
      setTransitionKind(link.transition);
      setDisplayTick((t) => t + 1);
      navigatePrototype(target, link.action === "open-overlay");
    },
    [navigatePrototype, nodes, prototypePreviewBack],
  );

  const clientToWorld = useCallback(
    (clientX: number, clientY: number) => {
      const el = clipRef.current;
      if (!el || !wr) return { x: 0, y: 0 };
      const r = el.getBoundingClientRect();
      const lx = clientX - r.left;
      const ly = clientY - r.top;
      return { x: lx + wr.x, y: ly + wr.y };
    },
    [wr],
  );

  const onOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      const wpt = clientToWorld(e.clientX, e.clientY);
      const hit = pickDeepestVisibleNodeAtWorldPoint(wpt.x, wpt.y, nodes, childOrder);
      const link = findClickLinkAlongChain(nodes, hit);
      if (!link) return;
      applyLink(link);
    },
    [applyLink, childOrder, clientToWorld, nodes],
  );

  const onOverlayMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
      hoverTimer.current = setTimeout(() => {
        const wpt = clientToWorld(e.clientX, e.clientY);
        const hit = pickDeepestVisibleNodeAtWorldPoint(wpt.x, wpt.y, nodes, childOrder);
        const link = findHoverLinkAlongChain(nodes, hit);
        if (!link || !link.targetFrameId) return;
        const key = `${hit}-${link.id}`;
        if (key === lastHoverFire.current) return;
        lastHoverFire.current = key;
        if (link.action === "back") {
          prototypePreviewBack();
          setTransitionKind(link.transition);
          setDisplayTick((t) => t + 1);
          return;
        }
        if (nodes[link.targetFrameId]?.type !== "frame") return;
        setTransitionKind(link.transition);
        setDisplayTick((t) => t + 1);
        navigatePrototype(link.targetFrameId, link.action === "open-overlay");
      }, 90);
    },
    [childOrder, clientToWorld, navigatePrototype, nodes, prototypePreviewBack],
  );

  useEffect(() => {
    return () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePrototypePreview();
    };
    if (pv) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pv, closePrototypePreview]);

  const previewMotionStyle = useMemo((): CSSProperties | undefined => {
    switch (transitionKind) {
      case "dissolve":
        return { animation: "pcProtoDissolve 0.22s ease-out both" };
      case "slide-left":
        return { animation: "pcProtoSlideLeft 0.22s ease-out both" };
      case "slide-right":
        return { animation: "pcProtoSlideRight 0.22s ease-out both" };
      default:
        return undefined;
    }
  }, [transitionKind, displayTick]);

  if (!mounted || !pv || !wr || !activeFrameId) return null;

  const rootIds = childOrder[ROOT] ?? [];

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-6 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closePrototypePreview();
      }}
    >
      <div className="relative flex max-h-[90vh] w-full max-w-[min(96vw,520px)] flex-col overflow-hidden rounded-xl border border-white/10 bg-app-panel shadow-2xl">
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
          <div className="min-w-0 text-[12px] font-medium text-white">
            <span className="text-app-muted">Present · </span>
            <span className="truncate">{nodes[activeFrameId]?.name ?? "Frame"}</span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => prototypePreviewBack()}
              className="rounded-md border border-white/10 px-2 py-1 text-[11px] font-medium text-app-fg hover:bg-app-hover"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => closePrototypePreview()}
              className="rounded-md p-1.5 text-app-muted hover:bg-app-hover hover:text-app-fg"
              aria-label="Close preview"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center bg-[#1a1a1a] p-4">
          <div
            key={`${activeFrameId}-${displayTick}`}
            ref={clipRef}
            className="relative overflow-hidden rounded-lg border border-app-border bg-white shadow-inner"
            style={{ width: wr.width, height: wr.height, ...previewMotionStyle }}
          >
            <div
              className="pointer-events-none absolute left-0 top-0"
              style={{
                width: 6000,
                height: 6000,
                transform: `translate(${-wr.x}px, ${-wr.y}px)`,
              }}
            >
              {rootIds.map((rid) => (
                <CanvasObject key={rid} id={rid} />
              ))}
            </div>
            <div
              className="absolute inset-0 z-10 cursor-pointer"
              onClick={onOverlayClick}
              onMouseMove={onOverlayMouseMove}
              aria-hidden
            />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
