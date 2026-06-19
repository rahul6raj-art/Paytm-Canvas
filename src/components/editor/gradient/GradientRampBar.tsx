"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Minus } from "lucide-react";
import { normalizeHex, parseHexInputLive } from "@/lib/color";
import { handlePanelFieldKeyDown, keyboardNudgeStep } from "@/lib/panelFieldKeyboard";
import { useInspectorValueScrub } from "@/lib/useInspectorValueScrub";
import { useEditorStore } from "@/stores/useEditorStore";
import { gradientBarCss, type FillGradient, type GradientStop } from "@/lib/gradient";
import { cn } from "@/lib/utils";
import { EditorHintWrap } from "@/components/editor/EditorHoverHint";

function formatStopPosition(position: number): string {
  const rounded = Math.round(position * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function stopHandleOrder(stops: GradientStop[]): GradientStop[] {
  return [...stops].sort((a, b) => a.id.localeCompare(b.id));
}

function StopHandle({
  stop,
  displayPosition,
  selected,
  disabled,
  dragging,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
}: {
  stop: GradientStop;
  displayPosition: number;
  selected: boolean;
  disabled?: boolean;
  dragging: boolean;
  onSelect: () => void;
  onDragStart: (stopId: string) => void;
  onDragMove: (stopId: string, clientX: number) => void;
  onDragEnd: (stopId: string, moved: boolean) => void;
}) {
  const color = normalizeHex(stop.color) ?? stop.color;
  const movedRef = useRef(false);

  const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect();
    movedRef.current = false;

    const stopId = stop.id;
    const captureEl = e.currentTarget;
    onDragStart(stopId);

    if (captureEl.setPointerCapture) {
      try {
        captureEl.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      movedRef.current = true;
      onDragMove(stopId, ev.clientX);
    };

    const finish = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      if (captureEl.releasePointerCapture) {
        try {
          if (captureEl.hasPointerCapture?.(e.pointerId)) {
            captureEl.releasePointerCapture(e.pointerId);
          }
        } catch {
          /* ignore */
        }
      }
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      onDragEnd(stopId, movedRef.current);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
  };

  return (
    <button
      type="button"
      data-gradient-stop-handle
      disabled={disabled}
      onPointerDown={onPointerDown}
      className={cn(
        "pointer-events-auto absolute top-0 -translate-x-1/2 touch-none disabled:opacity-40",
        "flex h-5 w-5 items-center justify-center",
        dragging && "z-10",
      )}
      style={{ left: `${displayPosition}%` }}
      aria-label={`Stop at ${formatStopPosition(displayPosition)}%`}
    >
      <span
        className={cn(
          "block h-3.5 w-3.5 rounded-sm border-2 shadow-sm",
          selected || dragging
            ? "border-white shadow-[0_0_0_1px_rgba(255,255,255,0.9)]"
            : "border-white/90",
        )}
        style={{ backgroundColor: color }}
      />
    </button>
  );
}

export function GradientRampBar({
  gradient,
  fillOpacity,
  selectedStopId,
  disabled,
  onSelectStop,
  onMoveStop,
  onAddStop,
  onOpenColorPicker,
  onDragEnd: onDragEndProp,
}: {
  gradient: FillGradient;
  fillOpacity: number;
  selectedStopId: string | null;
  disabled?: boolean;
  onSelectStop: (id: string) => void;
  onMoveStop: (id: string, position: number) => void;
  onAddStop: (position: number) => void;
  onOpenColorPicker?: (id: string) => void;
  onDragEnd?: () => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [draggingStopId, setDraggingStopId] = useState<string | null>(null);
  const [liveDragPosition, setLiveDragPosition] = useState<number | null>(null);
  const onMoveStopRef = useRef(onMoveStop);
  const onDragEndRef = useRef(onDragEndProp);

  useEffect(() => {
    onMoveStopRef.current = onMoveStop;
  }, [onMoveStop]);

  useEffect(() => {
    onDragEndRef.current = onDragEndProp;
  }, [onDragEndProp]);

  const orderedStops = useMemo(() => stopHandleOrder(gradient.stops), [gradient.stops]);

  const positionFromClientX = useCallback((clientX: number) => {
    const track = trackRef.current;
    if (!track) return 0;
    const rect = track.getBoundingClientRect();
    const t = (clientX - rect.left) / Math.max(1, rect.width);
    return Math.round(Math.max(0, Math.min(100, t * 100)) * 10) / 10;
  }, []);

  const onDragStart = useCallback((stopId: string) => {
    setDraggingStopId(stopId);
    setLiveDragPosition(null);
  }, []);

  const onDragMove = useCallback((stopId: string, clientX: number) => {
    const position = positionFromClientX(clientX);
    setLiveDragPosition(position);
    onMoveStopRef.current(stopId, position);
  }, [positionFromClientX]);

  const onDragEnd = useCallback((stopId: string, moved: boolean) => {
    setDraggingStopId(null);
    setLiveDragPosition(null);
    if (moved) {
      onDragEndRef.current?.();
    } else {
      onOpenColorPicker?.(stopId);
    }
  }, [onOpenColorPicker]);

  return (
    <div ref={trackRef} className="relative w-full pt-1">
      <div
        role="presentation"
        className={cn(
          "h-6 w-full rounded border border-app-border shadow-inner",
          disabled ? "pointer-events-none opacity-40" : "cursor-crosshair",
        )}
        style={{ background: gradientBarCss(gradient, fillOpacity) }}
        onPointerDown={(e) => {
          if (disabled || draggingStopId) return;
          if ((e.target as HTMLElement).closest("[data-gradient-stop-handle]")) return;
          const pos = positionFromClientX(e.clientX);
          onAddStop(pos);
        }}
      />
      <div className="relative mt-0 h-5 w-full">
        {orderedStops.map((stop) => {
          const displayPosition =
            draggingStopId === stop.id && liveDragPosition != null
              ? liveDragPosition
              : stop.position;
          return (
            <StopHandle
              key={stop.id}
              stop={stop}
              displayPosition={displayPosition}
              selected={selectedStopId === stop.id}
              dragging={draggingStopId === stop.id}
              disabled={disabled}
              onSelect={() => onSelectStop(stop.id)}
              onDragStart={onDragStart}
              onDragMove={onDragMove}
              onDragEnd={onDragEnd}
            />
          );
        })}
      </div>
    </div>
  );
}

export function GradientStopRow({
  stop,
  selected,
  disabled,
  canRemove,
  onSelect,
  onOpenColorPicker,
  onChange,
  onRemove,
}: {
  stop: GradientStop;
  selected: boolean;
  disabled?: boolean;
  canRemove: boolean;
  onSelect: () => void;
  onOpenColorPicker?: () => void;
  onChange: (
    patch: Partial<Pick<GradientStop, "color" | "opacity" | "position">>,
    opts?: { skipHistory?: boolean },
  ) => void;
  onRemove: () => void;
}) {
  const safe = normalizeHex(stop.color) ?? stop.color;
  const [hexText, setHexText] = useState(safe.slice(1).toUpperCase());
  const [posText, setPosText] = useState(() => formatStopPosition(stop.position));
  const [opText, setOpText] = useState(String(Math.round((stop.opacity ?? 1) * 100)));
  const [posFocused, setPosFocused] = useState(false);
  const posDirtyRef = useRef(false);
  const hexEditingRef = useRef(false);
  const hexDirtyLiveRef = useRef(false);

  const { scrubbing: posScrubbing, scrubActiveRef: posScrubActiveRef, bindScrubInput: bindPosScrub } =
    useInspectorValueScrub({
      disabled,
      value: stop.position,
      min: 0,
      max: 100,
      decimals: 1,
      onChange: (n) => {
        posDirtyRef.current = true;
        const clamped = Math.round(Math.max(0, Math.min(100, n)) * 10) / 10;
        setPosText(formatStopPosition(clamped));
        onChange({ position: clamped }, { skipHistory: true });
      },
    });

  const posScrubBind = bindPosScrub(
    "h-6 w-10 shrink-0 rounded border border-app-border bg-app-surface px-1 text-center font-mono tabular-nums text-ui text-app-fg",
    posFocused,
  );

  const displayHex = parseHexInputLive(hexText) ?? safe;

  useEffect(() => {
    if (!hexEditingRef.current) {
      setHexText((normalizeHex(stop.color) ?? stop.color).slice(1).toUpperCase());
    }
    if (!posDirtyRef.current && !posFocused && !posScrubbing && !posScrubActiveRef.current) {
      setPosText(formatStopPosition(stop.position));
    }
    setOpText(String(Math.round((stop.opacity ?? 1) * 100)));
  }, [stop.id, stop.color, stop.position, stop.opacity]);

  const commitPosition = (raw: string, opts?: { skipHistory?: boolean }) => {
    const n = parseFloat(raw);
    if (Number.isFinite(n)) {
      const clamped = Math.round(Math.max(0, Math.min(100, n)) * 10) / 10;
      onChange({ position: clamped }, opts);
      setPosText(formatStopPosition(clamped));
    } else {
      setPosText(formatStopPosition(stop.position));
    }
    posDirtyRef.current = false;
  };

  const commitOpacity = (raw: string, opts?: { skipHistory?: boolean }) => {
    const n = parseInt(raw, 10);
    if (Number.isFinite(n)) {
      const clamped = Math.max(0, Math.min(100, n));
      onChange({ opacity: clamped / 100 }, opts);
      setOpText(String(clamped));
    } else {
      setOpText(String(Math.round((stop.opacity ?? 1) * 100)));
    }
  };

  const nudgePosition = (direction: 1 | -1, shift: boolean, alt: boolean) => {
    const step = keyboardNudgeStep(1, 1, shift, alt) * direction;
    const base = parseFloat(posText);
    const current = Number.isFinite(base) ? base : stop.position;
    const next = Math.round(Math.max(0, Math.min(100, current + step)) * 10) / 10;
    posDirtyRef.current = true;
    setPosText(formatStopPosition(next));
    onChange({ position: next }, { skipHistory: true });
  };

  const nudgeOpacity = (direction: 1 | -1, shift: boolean, alt: boolean) => {
    const step = keyboardNudgeStep(1, 0, shift, alt) * direction;
    const base = parseInt(opText, 10);
    const current = Number.isFinite(base) ? base : Math.round((stop.opacity ?? 1) * 100);
    const next = Math.max(0, Math.min(100, current + step));
    setOpText(String(next));
    onChange({ opacity: next / 100 }, { skipHistory: true });
  };

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-md border px-1.5 py-1",
        selected ? "border-app-border-subtle bg-app-inset" : "border-app-border bg-app-field",
      )}
      onClick={onSelect}
    >
      <input
        type="text"
        inputMode="decimal"
        disabled={disabled}
        aria-label="Stop position percent"
        {...posScrubBind}
        value={posText}
        onFocus={() => {
          setPosFocused(true);
          onSelect();
        }}
        onChange={(e) => {
          posDirtyRef.current = true;
          const next = e.target.value.replace(/[^\d.]/g, "");
          setPosText(next);
          const n = parseFloat(next);
          if (Number.isFinite(n)) {
            onChange(
              { position: Math.round(Math.max(0, Math.min(100, n)) * 10) / 10 },
              { skipHistory: true },
            );
          }
        }}
        onBlur={() => {
          if (posScrubActiveRef.current) return;
          setPosFocused(false);
          commitPosition(posText);
        }}
        onKeyDown={(e) => {
          handlePanelFieldKeyDown(e, {
            onEnter: () => commitPosition(posText),
            onArrowNudge: nudgePosition,
          });
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
          onSelect();
          posScrubBind.onPointerDown(e);
        }}
        onClick={(e) => e.stopPropagation()}
      />
      <span className="text-ui text-app-muted">%</span>
      <EditorHintWrap title="Stop color" disabled={disabled}>
        <button
          type="button"
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
            onOpenColorPicker?.();
          }}
          className="flex h-6 min-w-0 flex-1 items-center gap-1 rounded border border-app-border bg-app-surface px-1.5"
        >
        <span
          className="h-4 w-4 shrink-0 rounded-sm border border-app-border shadow-inner"
          style={{ backgroundColor: displayHex }}
        />
        <input
          type="text"
          disabled={disabled}
          spellCheck={false}
          autoComplete="off"
          value={hexText}
          onChange={(e) => {
            const next = e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
            setHexText(next.toUpperCase());
            const hex = parseHexInputLive(next);
            if (hex) {
              onChange({ color: hex }, { skipHistory: true });
              hexDirtyLiveRef.current = true;
            }
          }}
          onBlur={() => {
            hexEditingRef.current = false;
            const hex = normalizeHex(`#${hexText}`) ?? parseHexInputLive(hexText);
            if (hex) onChange({ color: hex }, { skipHistory: true });
            else setHexText(safe.slice(1).toUpperCase());
            if (hexDirtyLiveRef.current) {
              useEditorStore.getState().pushHistory();
              hexDirtyLiveRef.current = false;
            }
          }}
          onKeyDown={(e) => handlePanelFieldKeyDown(e)}
          onFocus={() => {
            hexEditingRef.current = true;
            onSelect();
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          onClick={(e) => e.stopPropagation()}
          className="h-full w-[4.25rem] shrink-0 bg-transparent font-mono uppercase tabular-nums text-ui leading-none text-app-fg outline-none"
        />
        <input
          type="text"
          disabled={disabled}
          value={opText}
          onChange={(e) => setOpText(e.target.value.replace(/[^\d]/g, "").slice(0, 3))}
          onBlur={() => commitOpacity(opText)}
          onKeyDown={(e) => {
            handlePanelFieldKeyDown(e, {
              onEnter: () => {
                commitOpacity(opText);
                e.currentTarget.blur();
              },
              onArrowNudge: nudgeOpacity,
            });
          }}
          onFocus={() => onSelect()}
          onPointerDown={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          onClick={(e) => e.stopPropagation()}
          className="ml-auto w-7 shrink-0 bg-transparent text-right font-mono tabular-nums text-ui leading-none text-app-fg outline-none"
        />
        <span className="text-ui text-app-muted">%</span>
        </button>
      </EditorHintWrap>
      <button
        type="button"
        disabled={disabled || !canRemove}
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-app-muted hover:bg-app-hover hover:text-app-fg disabled:opacity-30"
        aria-label="Remove stop"
      >
        <Minus className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
    </div>
  );
}
