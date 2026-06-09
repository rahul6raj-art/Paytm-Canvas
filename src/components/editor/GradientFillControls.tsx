"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { Plus, RotateCcw, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ColorInput } from "./ColorInput";
import { GradientStopColorPopover } from "./GradientStopColorPopover";
import { PropertyNumberInput } from "./PropertyInput";
import {
  gradientInspectorBarPaintCss,
  newGradientStopId,
  normalizeFillGradient,
  type FillGradient,
  type GradientKind,
  type GradientStop,
} from "@/lib/fillGradient";

type GradientFillControlsProps = {
  gradient: FillGradient;
  fallbackFill?: string;
  fillEnabled: boolean;
  fillOpacity: number;
  /** Preview bar uses fill or stroke paint CSS. */
  paintMode?: "fill" | "stroke";
  locked?: boolean;
  instanceKey: string;
  /** When set, edits update the linked style instead of the layer only. */
  linkedStyleName?: string;
  onChange: (gradient: FillGradient, opts?: { skipHistory?: boolean }) => void;
  onBeginDrag?: () => void;
};

export function GradientFillControls({
  gradient: gradientIn,
  fallbackFill,
  fillEnabled,
  fillOpacity,
  paintMode = "fill",
  locked,
  instanceKey,
  linkedStyleName,
  onChange,
  onBeginDrag,
}: GradientFillControlsProps) {
  const g = useMemo(
    () => normalizeFillGradient(gradientIn, fallbackFill),
    [gradientIn, fallbackFill],
  );
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [colorPickerStopId, setColorPickerStopId] = useState<string | null>(null);
  const barDragRef = useRef<{ stopId: string; pointerId: number } | null>(null);
  const stopButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const colorPickerAnchorRef = useRef<HTMLButtonElement | null>(null);
  const [pickerAnchorEl, setPickerAnchorEl] = useState<HTMLButtonElement | null>(null);

  const POINTER_CLICK_SLOP = 5;

  const commit = useCallback(
    (next: FillGradient, opts?: { skipHistory?: boolean }) => {
      onChange(normalizeFillGradient(next, fallbackFill), opts);
    },
    [onChange, fallbackFill],
  );

  const previewCss = gradientInspectorBarPaintCss(g, fillEnabled ? fillOpacity : 0);

  const addStopAt = (position: number): string => {
    const sorted = [...g.stops].sort((a, b) => a.position - b.position);
    const before = sorted.filter((s) => s.position <= position).pop();
    const after = sorted.find((s) => s.position > position);
    const color =
      before && after
        ? before.color
        : before?.color ?? after?.color ?? fallbackFill ?? "#ffffff";
    const id = newGradientStopId();
    commit({
      ...g,
      stops: [...g.stops, { id, color, position }].sort((a, b) => a.position - b.position),
    });
    setSelectedStopId(id);
    return id;
  };

  const updateStop = (
    stopId: string,
    patch: Partial<GradientStop>,
    opts?: { skipHistory?: boolean },
  ) => {
    commit(
      {
        ...g,
        stops: g.stops.map((s) => (s.id === stopId ? { ...s, ...patch } : s)),
      },
      opts,
    );
  };

  const removeStop = (stopId: string) => {
    if (g.stops.length <= 2) return;
    commit({ ...g, stops: g.stops.filter((s) => s.id !== stopId) });
    if (selectedStopId === stopId) setSelectedStopId(null);
  };

  const bindBarStopDrag = (barEl: HTMLDivElement, stopId: string) => {
    const onMove = (ev: PointerEvent) => {
      const d = barDragRef.current;
      if (!d || d.stopId !== stopId || ev.pointerId !== d.pointerId) return;
      const pct = positionFromBarPointer(barEl, ev.clientX, ev.clientY);
      updateStop(stopId, { position: pct }, { skipHistory: true });
    };
    const onUp = (ev: PointerEvent) => {
      const d = barDragRef.current;
      if (!d || ev.pointerId !== d.pointerId) return;
      barDragRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  const setStopButtonRef = (stopId: string) => (el: HTMLButtonElement | null) => {
    if (el) stopButtonRefs.current.set(stopId, el);
    else stopButtonRefs.current.delete(stopId);
  };

  const openColorPickerForStop = (stopId: string) => {
    setSelectedStopId(stopId);
    setColorPickerStopId(stopId);
  };

  const positionFromBarPointer = (barEl: HTMLDivElement, clientX: number, clientY: number) => {
    const rect = barEl.getBoundingClientRect();
    return Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
  };

  useLayoutEffect(() => {
    if (!colorPickerStopId) {
      colorPickerAnchorRef.current = null;
      setPickerAnchorEl(null);
      return;
    }
    const el = stopButtonRefs.current.get(colorPickerStopId) ?? null;
    colorPickerAnchorRef.current = el;
    setPickerAnchorEl(el);
  }, [colorPickerStopId, g.stops]);

  const onStopHandlePointerDown = (
    stop: GradientStop,
    e: ReactPointerEvent<HTMLButtonElement>,
    barEl: HTMLDivElement,
  ) => {
    if (locked || !fillEnabled) return;
    e.stopPropagation();
    setSelectedStopId(stop.id);
    const startX = e.clientX;
    const startY = e.clientY;
    let dragging = false;

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      if (dragging) return;
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) <= POINTER_CLICK_SLOP) return;
      dragging = true;
      onBeginDrag?.();
      barDragRef.current = { stopId: stop.id, pointerId: e.pointerId };
      bindBarStopDrag(barEl, stop.id);
    };

    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      if (!dragging) {
        openColorPickerForStop(stop.id);
      }
      barDragRef.current = null;
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  const onBarPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (locked || !fillEnabled) return;
    if ((e.target as HTMLElement).closest("button")) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const barEl = e.currentTarget;

    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) > POINTER_CLICK_SLOP) return;
      const id = addStopAt(positionFromBarPointer(barEl, ev.clientX, ev.clientY));
      requestAnimationFrame(() => openColorPickerForStop(id));
    };

    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  const colorPickerStop = colorPickerStopId
    ? g.stops.find((s) => s.id === colorPickerStopId)
    : undefined;

  const kinds: { kind: GradientKind; label: string }[] = [
    { kind: "linear", label: "Linear" },
    { kind: "radial", label: "Radial" },
    { kind: "angular", label: "Angular" },
    { kind: "diamond", label: "Diamond" },
  ];

  return (
    <div className="space-y-2">
      {linkedStyleName ? (
        <p className="text-[10px] leading-snug text-app-muted">
          Editing style <span className="font-medium text-app-fg">{linkedStyleName}</span> — changes
          apply to all layers using this gradient.
        </p>
      ) : null}

      <div
        role="slider"
        aria-label="Gradient stops"
        className={cn(
          "relative h-9 w-full cursor-crosshair rounded border border-app-border",
          (!fillEnabled || locked) && "pointer-events-none opacity-50",
        )}
        style={{ background: previewCss }}
        onPointerDown={onBarPointerDown}
      >
        {g.stops.map((stop) => (
          <button
            key={stop.id}
            ref={setStopButtonRef(stop.id)}
            type="button"
            title={`Stop ${Math.round(stop.position)}% — click for color, drag to move`}
            className={cn(
              "absolute top-1/2 z-[1] h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-2 shadow-sm active:cursor-grabbing",
              selectedStopId === stop.id || colorPickerStopId === stop.id
                ? "scale-110 border-amber-300 ring-1 ring-amber-300/50"
                : "border-white hover:scale-105",
            )}
            style={{
              left: `${stop.position}%`,
              backgroundColor: stop.color,
            }}
            onPointerDown={(e) => {
              const bar = e.currentTarget.parentElement as HTMLDivElement;
              onStopHandlePointerDown(stop, e, bar);
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              if (colorPickerStopId === stop.id) setColorPickerStopId(null);
              removeStop(stop.id);
            }}
          />
        ))}
      </div>
      <p className="text-[10px] leading-snug text-app-subtle">
        Click the bar to add a stop; click a stop for the color picker; drag stops to move. Double-click a stop to
        remove. Canvas: drag stops, double-click line to add.
      </p>

      {colorPickerStop && pickerAnchorEl ? (
        <GradientStopColorPopover
          open={Boolean(colorPickerStopId)}
          anchorRef={colorPickerAnchorRef}
          remeasureKey={pickerAnchorEl}
          hex={colorPickerStop.color}
          instanceKey={`${instanceKey}-grad-stop-picker-${colorPickerStop.id}`}
          disabled={locked || !fillEnabled}
          onClose={() => setColorPickerStopId(null)}
          onCommitHex={(hex) => updateStop(colorPickerStop.id, { color: hex })}
        />
      ) : null}

      <div>
        <div className="mb-0.5 text-[11px] font-medium text-app-subtle">Type</div>
        <div className="grid grid-cols-2 gap-0.5">
          {kinds.map(({ kind, label }) => (
            <button
              key={kind}
              type="button"
              disabled={locked || !fillEnabled}
              onClick={() =>
                commit({
                  ...g,
                  kind,
                  transform: {
                    ...g.transform,
                    rotation:
                      kind === "linear" && !g.transform.rotation
                        ? 180
                        : g.transform.rotation,
                  },
                })
              }
              className={cn(
                "h-6 rounded border text-[10px] font-semibold transition-colors disabled:opacity-40",
                g.kind === kind
                  ? "border-accent/45 bg-accent/15 text-white"
                  : "border-app-border text-app-muted hover:bg-app-hover",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {(g.kind === "linear" || g.kind === "angular") && (
        <PropertyNumberInput
          commitOnInput={false}
          label={g.kind === "linear" ? "Angle °" : "Start angle °"}
          value={Math.round(g.transform.rotation)}
          instanceKey={`${instanceKey}-grad-rotation`}
          disabled={locked || !fillEnabled}
          min={0}
          max={359}
          onCommit={(v) => {
            const rotation = ((Math.round(v) % 360) + 360) % 360;
            commit({ ...g, transform: { ...g.transform, rotation } });
          }}
        />
      )}

      {(g.kind === "radial" || g.kind === "diamond" || g.kind === "linear") && (
        <div className="rounded border border-app-border-subtle bg-white/[0.02] p-1.5">
          <div className="mb-1 text-[10px] font-medium text-app-subtle">Transform</div>
          <div className="grid grid-cols-2 gap-1">
            <PropertyNumberInput
              commitOnInput={false}
              label="Center X %"
              value={Math.round(g.transform.cx * 100)}
              instanceKey={`${instanceKey}-grad-cx`}
              disabled={locked || !fillEnabled}
              min={0}
              max={100}
              onCommit={(v) =>
                commit({
                  ...g,
                  transform: { ...g.transform, cx: Math.min(1, Math.max(0, v / 100)) },
                })
              }
            />
            <PropertyNumberInput
              commitOnInput={false}
              label="Center Y %"
              value={Math.round(g.transform.cy * 100)}
              instanceKey={`${instanceKey}-grad-cy`}
              disabled={locked || !fillEnabled}
              min={0}
              max={100}
              onCommit={(v) =>
                commit({
                  ...g,
                  transform: { ...g.transform, cy: Math.min(1, Math.max(0, v / 100)) },
                })
              }
            />
            <PropertyNumberInput
              commitOnInput={false}
              label="Width %"
              value={Math.round(g.transform.width * 100)}
              instanceKey={`${instanceKey}-grad-tw`}
              disabled={locked || !fillEnabled}
              min={5}
              max={200}
              onCommit={(v) =>
                commit({
                  ...g,
                  transform: { ...g.transform, width: Math.min(2, Math.max(0.05, v / 100)) },
                })
              }
            />
            <PropertyNumberInput
              commitOnInput={false}
              label="Height %"
              value={Math.round(g.transform.height * 100)}
              instanceKey={`${instanceKey}-grad-th`}
              disabled={locked || !fillEnabled}
              min={5}
              max={200}
              onCommit={(v) =>
                commit({
                  ...g,
                  transform: { ...g.transform, height: Math.min(2, Math.max(0.05, v / 100)) },
                })
              }
            />
          </div>
        </div>
      )}

      <div className="flex gap-1">
        <button
          type="button"
          disabled={locked || !fillEnabled}
          onClick={() => {
            const mid =
              g.stops.length >= 2
                ? (g.stops[0]!.position + g.stops.at(-1)!.position) / 2
                : 50;
            const id = addStopAt(mid);
            requestAnimationFrame(() => openColorPickerForStop(id));
          }}
          className="flex h-6 flex-1 items-center justify-center gap-1 rounded border border-app-border bg-app-panel text-[10px] font-medium text-app-fg hover:bg-app-hover disabled:opacity-40"
        >
          <Plus className="h-3 w-3" strokeWidth={2} />
          Add stop
        </button>
        <button
          type="button"
          disabled={locked || !fillEnabled || g.stops.length < 2}
          title="Reverse stop order"
          onClick={() => {
            const reversed = g.stops.map((s) => ({
              ...s,
              position: 100 - s.position,
            }));
            commit({ ...g, stops: reversed });
          }}
          className="flex h-6 w-8 items-center justify-center rounded border border-app-border bg-app-panel text-app-muted hover:bg-app-hover disabled:opacity-40"
        >
          <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
      </div>

      <div className="space-y-1">
        {g.stops.map((stop, index) => {
          const selected = selectedStopId === stop.id;
          return (
            <div
              key={stop.id}
              className={cn(
                "rounded border p-1.5 transition-colors",
                selected ? "border-accent/35 bg-accent/10" : "border-app-border-subtle",
              )}
            >
              <div className="mb-1 flex items-center justify-between gap-1">
                <button
                  type="button"
                  className="text-[10px] font-medium text-app-subtle hover:text-app-fg"
                  onClick={() => openColorPickerForStop(stop.id)}
                >
                  Stop {index + 1}
                </button>
                {g.stops.length > 2 ? (
                  <button
                    type="button"
                    disabled={locked || !fillEnabled}
                    onClick={() => removeStop(stop.id)}
                    className="rounded p-0.5 text-rose-300 hover:bg-app-hover disabled:opacity-40"
                    aria-label="Remove stop"
                  >
                    <Trash2 className="h-3 w-3" strokeWidth={1.75} />
                  </button>
                ) : null}
              </div>
              <ColorInput
                label="Color"
                hex={stop.color}
                instanceKey={`${instanceKey}-grad-stop-${stop.id}`}
                disabled={locked || !fillEnabled}
                onCommitHex={(hex) => updateStop(stop.id, { color: hex })}
              />
              <div className="mt-1">
                <PropertyNumberInput
                  commitOnInput={false}
                  label="Position %"
                  value={Math.round(stop.position)}
                  instanceKey={`${instanceKey}-grad-pos-${stop.id}`}
                  disabled={locked || !fillEnabled}
                  min={0}
                  max={100}
                  onCommit={(v) =>
                    updateStop(stop.id, { position: Math.min(100, Math.max(0, v)) })
                  }
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
