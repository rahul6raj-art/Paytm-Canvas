"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { FlipHorizontal2, Minus, Plus } from "lucide-react";
import {
  changeGradientKind,
  gradientAngleDeg,
  gradientFingerprint,
  insertStopAtPosition,
  normalizeFillGradient,
  removeStop,
  reverseGradientStops,
  setGradientAngle,
  updateStop,
  updateStopPreserveOrder,
  type FillGradient,
  type GradientKind,
} from "@/lib/gradient";
import type { GradientEditorFocusRequest } from "@/lib/gradientEditorFocus";
import { setActiveGradientStopTarget } from "@/lib/gradientStopKeyboard";
import { handlePanelFieldKeyDown, keyboardNudgeStep } from "@/lib/panelFieldKeyboard";
import { useInspectorValueScrub } from "@/lib/useInspectorValueScrub";
import { normalizeHex } from "@/lib/color";
import { useEditorStore } from "@/stores/useEditorStore";
import { ColorPickerPanel } from "../ColorPickerPanel";
import { InspectorColorPickerAside } from "../InspectorColorPickerAside";
import { InspectorHintIconButton } from "../design-panel/InspectorPrimitives";
import { GradientRampBar, GradientStopRow } from "./GradientRampBar";
import { appFieldInnerClass, appFieldShellClass, inspectorRowGapClass } from "@/lib/appFieldStyles";
import { inspectorFieldIconButtonClass, inspectorLucideProps } from "@/lib/inspectorIconStyles";
import { cn } from "@/lib/utils";

const KIND_OPTIONS: { value: GradientKind; label: string }[] = [
  { value: "linear", label: "Linear" },
  { value: "radial", label: "Radial" },
  { value: "angular", label: "Angular" },
  { value: "diamond", label: "Diamond" },
];

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="inspector-field-label mb-1">{children}</div>;
}

function normalizeGradientAngleDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

function GradientAngleInput({
  value,
  disabled,
  ariaLabel,
  onCommit,
}: {
  value: number;
  disabled?: boolean;
  ariaLabel: string;
  onCommit: (deg: number, opts?: { skipHistory?: boolean }) => void;
}) {
  const displayDeg = Math.round(normalizeGradientAngleDeg(value));
  const [text, setText] = useState(() => String(displayDeg));
  const [focused, setFocused] = useState(false);

  const commitDeg = (n: number, skipHistory = false) => {
    const next = normalizeGradientAngleDeg(n);
    onCommit(next, skipHistory ? { skipHistory: true } : undefined);
    setText(String(Math.round(next)));
  };

  const { scrubbing, scrubActiveRef, bindScrubInput } = useInspectorValueScrub({
    disabled,
    value: displayDeg,
    min: 0,
    max: 360,
    onChange: (n) => commitDeg(n, true),
  });

  useEffect(() => {
    if (!focused && !scrubbing && !scrubActiveRef.current) {
      setText(String(displayDeg));
    }
  }, [displayDeg, focused, scrubbing, scrubActiveRef]);

  const applyDraft = (raw: string) => {
    const n = parseFloat(raw);
    if (!Number.isFinite(n)) return false;
    commitDeg(n);
    return true;
  };

  return (
    <div className={cn(appFieldShellClass, "min-w-0 flex-1", disabled && "opacity-40")}>
      <input
        type="text"
        inputMode="decimal"
        disabled={disabled}
        aria-label={ariaLabel}
        {...bindScrubInput(cn(appFieldInnerClass, "font-mono tabular-nums"), focused)}
      value={text}
      onFocus={() => setFocused(true)}
      onChange={(e) => setText(e.target.value.replace(/[^\d.-]/g, ""))}
      onBlur={() => {
        if (scrubActiveRef.current) return;
        setFocused(false);
        if (!applyDraft(text)) setText(String(displayDeg));
      }}
      onKeyDown={(e) =>
        handlePanelFieldKeyDown(e, {
          onEnter: () => {
            if (!applyDraft(text)) setText(String(displayDeg));
            e.currentTarget.blur();
          },
          onArrowNudge: (dir, shift) => {
            const step = keyboardNudgeStep(1, 0, shift, false) * dir;
            const base = parseFloat(text);
            const next = normalizeGradientAngleDeg(Number.isFinite(base) ? base : displayDeg) + step;
            commitDeg(next, true);
          },
        })
      }
      />
    </div>
  );
}

/** Figma-style gradient editor — type, ramp, stops, angle. */
export function GradientFillEditor({
  gradient: initial,
  fillOpacity,
  disabled,
  embedded = true,
  nodeId,
  colorPickerBesideRef,
  onColorPickerOpenChange,
  focusStop,
  onChange,
  onCreateStyle,
}: {
  gradient: FillGradient;
  fillOpacity: number;
  disabled?: boolean;
  /** When false, omits card chrome (used inside floating dialog). */
  embedded?: boolean;
  /** Target node for canvas keyboard actions (delete stop, etc.). */
  nodeId?: string;
  /** When set, stop color picker docks to the left of this host element. */
  colorPickerBesideRef?: RefObject<HTMLElement | null>;
  onColorPickerOpenChange?: (open: boolean) => void;
  /** Focus a specific stop when opened from canvas handles. */
  focusStop?: Pick<GradientEditorFocusRequest, "stopId" | "openColorPicker" | "nonce"> | null;
  onChange: (g: FillGradient, opts?: { skipHistory?: boolean }) => void;
  onCreateStyle?: () => void;
}) {
  const [gradient, setGradient] = useState(() => normalizeFillGradient(initial));
  const gradientRef = useRef(gradient);
  const rampDragActiveRef = useRef(false);
  const liveStopPatchRef = useRef(false);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(
    () => gradient.stops[0]?.id ?? null,
  );
  const activeStopIdRef = useRef<string | null>(selectedStopId);
  const [colorPickerStopId, setColorPickerStopId] = useState<string | null>(null);
  const [kindOpen, setKindOpen] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const lastExternalFp = useRef(gradientFingerprint(initial));

  const externalFp = gradientFingerprint(initial);

  const applyGradient = useCallback(
    (normalized: FillGradient, opts?: { skipHistory?: boolean }) => {
      gradientRef.current = normalized;
      lastExternalFp.current = gradientFingerprint(normalized);
      setGradient(normalized);
      onChange(normalized, opts);
    },
    [onChange],
  );

  const rememberActiveStop = useCallback(
    (stopId: string | null) => {
      activeStopIdRef.current = stopId;
      if (stopId) setSelectedStopId(stopId);
      if (nodeId && stopId) setActiveGradientStopTarget({ nodeId, stopId });
    },
    [nodeId],
  );

  useEffect(() => {
    if (!nodeId) return;
    const stopId = activeStopIdRef.current;
    if (stopId) setActiveGradientStopTarget({ nodeId, stopId });
  }, [nodeId]);

  useEffect(() => {
    if (rampDragActiveRef.current) return;
    if (externalFp === lastExternalFp.current) {
      liveStopPatchRef.current = false;
      return;
    }
    if (liveStopPatchRef.current) return;
    const prevGradient = gradientRef.current;
    lastExternalFp.current = externalFp;
    const g = normalizeFillGradient(initial);
    gradientRef.current = g;
    setGradient(g);
    setSelectedStopId((prev) => {
      const active = activeStopIdRef.current;
      if (active && g.stops.some((s) => s.id === active)) return active;
      if (g.stops.some((s) => s.id === prev)) return prev;
      const prevStop = prevGradient.stops.find((s) => s.id === prev);
      if (prevStop) {
        const byPosition = g.stops.find((s) => s.position === prevStop.position);
        if (byPosition) {
          activeStopIdRef.current = byPosition.id;
          return byPosition.id;
        }
      }
      const fallback = g.stops[0]?.id ?? null;
      activeStopIdRef.current = fallback;
      return fallback;
    });
    setColorPickerStopId((prev) =>
      prev && g.stops.some((s) => s.id === prev) ? prev : null,
    );
  }, [externalFp, initial]);

  const commit = useCallback(
    (
      next: FillGradient | ((prev: FillGradient) => FillGradient),
      opts?: { skipHistory?: boolean },
    ) => {
      const raw = typeof next === "function" ? next(gradientRef.current) : next;
      applyGradient(normalizeFillGradient(raw), opts);
    },
    [applyGradient],
  );

  const patchStop = useCallback(
    (
      stopId: string,
      patch: Partial<{ color: string; opacity: number; position: number }>,
      opts?: { skipHistory?: boolean },
    ) => {
      rememberActiveStop(stopId);
      const normalizedPatch = { ...patch };
      if (normalizedPatch.color != null) {
        normalizedPatch.color = normalizeHex(normalizedPatch.color) ?? normalizedPatch.color;
      }
      if (opts?.skipHistory) {
        liveStopPatchRef.current = true;
        commit(
          (prev) => updateStopPreserveOrder(prev, stopId, normalizedPatch),
          opts,
        );
        return;
      }
      commit(
        (prev) =>
          normalizedPatch.position != null
            ? updateStop(prev, stopId, normalizedPatch)
            : updateStopPreserveOrder(prev, stopId, normalizedPatch),
        opts,
      );
    },
    [commit, rememberActiveStop],
  );

  const moveStopOnRamp = useCallback(
    (stopId: string, position: number) => {
      rampDragActiveRef.current = true;
      liveStopPatchRef.current = true;
      const next = normalizeFillGradient(
        updateStopPreserveOrder(gradientRef.current, stopId, {
          position: Math.max(0, Math.min(100, position)),
        }),
      );
      applyGradient(next, { skipHistory: true });
    },
    [applyGradient],
  );

  const finalizeStopDrag = useCallback(() => {
    rampDragActiveRef.current = false;
    const normalized = normalizeFillGradient({
      ...gradientRef.current,
      stops: [...gradientRef.current.stops].sort((a, b) => a.position - b.position),
    });
    applyGradient(normalized);
    useEditorStore.getState().pushHistory();
  }, [applyGradient]);

  const openColorPickerForStop = useCallback((stopId: string) => {
    rememberActiveStop(stopId);
    setColorPickerStopId(stopId);
    setColorPickerOpen(true);
  }, [rememberActiveStop]);

  const closeColorPicker = useCallback(() => {
    setColorPickerOpen(false);
    setColorPickerStopId(null);
  }, []);

  useEffect(() => {
    onColorPickerOpenChange?.(colorPickerOpen);
  }, [colorPickerOpen, onColorPickerOpenChange]);

  useEffect(() => {
    if (!focusStop) return;
    const g = normalizeFillGradient(gradientRef.current);
    let stopId = focusStop.stopId;
    if (!g.stops.some((s) => s.id === stopId)) {
      const prev = gradientRef.current.stops.find((s) => s.id === stopId);
      const byPosition = prev
        ? g.stops.find((s) => s.position === prev.position)
        : undefined;
      if (!byPosition) return;
      stopId = byPosition.id;
    }
    rememberActiveStop(stopId);
    if (focusStop.openColorPicker) {
      setColorPickerStopId(stopId);
      setColorPickerOpen(true);
    }
  }, [focusStop?.nonce, focusStop?.stopId, focusStop?.openColorPicker, rememberActiveStop]);

  const sortedStops = useMemo(
    () => [...gradient.stops].sort((a, b) => a.position - b.position),
    [gradient.stops],
  );

  const selectedStop =
    sortedStops.find((s) => s.id === selectedStopId) ??
    sortedStops.find((s) => s.id === activeStopIdRef.current) ??
    null;

  const colorPickerStop =
    (colorPickerStopId
      ? sortedStops.find((s) => s.id === colorPickerStopId)
      : null) ?? selectedStop;

  return (
    <div
      className={cn(
        "space-y-3",
        embedded && "rounded-lg border border-app-border-subtle bg-app-inset p-2.5",
      )}
    >
      {embedded ? (
        <div className="flex items-center justify-between gap-2">
          <span className="text-ui font-medium text-app-fg">Gradient</span>
        </div>
      ) : null}

      <div>
        <FieldLabel>Type</FieldLabel>
        <div className="relative">
          <button
            type="button"
            disabled={disabled}
            onClick={() => setKindOpen((o) => !o)}
            className={cn(appFieldShellClass, "w-full items-center justify-between px-2 text-ui text-app-fg disabled:opacity-40")}
          >
            <span>{KIND_OPTIONS.find((k) => k.value === gradient.kind)?.label ?? "Linear"}</span>
            <span className="text-app-muted text-[10px]">▼</span>
          </button>
          {kindOpen ? (
            <ul className="absolute left-0 right-0 top-full z-50 mt-0.5 editor-floating-menu py-0.5">
              {KIND_OPTIONS.map((opt) => (
                <li key={opt.value}>
                  <button
                    type="button"
                    className={cn(
                      "w-full px-2 py-1.5 text-left text-ui transition-colors hover:bg-app-hover",
                      gradient.kind === opt.value ? "bg-app-inset text-app-fg" : "text-app-fg",
                    )}
                    onClick={() => {
                      setKindOpen(false);
                      commit((prev) => changeGradientKind(prev, opt.value));
                    }}
                  >
                    {opt.label}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      {gradient.kind === "linear" || gradient.kind === "angular" ? (
        <div>
          <FieldLabel>{gradient.kind === "angular" ? "Rotation" : "Angle"}</FieldLabel>
          <div className={cn("flex items-center", inspectorRowGapClass)}>
            <InspectorHintIconButton
              title="Reverse gradient"
              disabled={disabled}
              onClick={() => commit((prev) => reverseGradientStops(prev))}
              className={inspectorFieldIconButtonClass}
            >
              <FlipHorizontal2 {...inspectorLucideProps()} />
            </InspectorHintIconButton>
            <GradientAngleInput
              value={gradientAngleDeg(gradient)}
              disabled={disabled}
              ariaLabel={gradient.kind === "angular" ? "Gradient rotation" : "Gradient angle"}
              onCommit={(deg, opts) => commit((prev) => setGradientAngle(prev, deg), opts)}
            />
            <span className="shrink-0 text-ui text-app-muted">°</span>
          </div>
        </div>
      ) : null}

      <div>
        <FieldLabel>Ramp</FieldLabel>
        <GradientRampBar
          gradient={gradient}
          fillOpacity={fillOpacity}
          selectedStopId={selectedStopId}
          disabled={disabled}
          onSelectStop={rememberActiveStop}
          onMoveStop={(id, position) => {
            moveStopOnRamp(id, position);
          }}
          onAddStop={(position) => {
            commit((prev) => {
              const next = insertStopAtPosition(prev, position);
              const added = next.stops.find((s) => !prev.stops.some((o) => o.id === s.id));
              if (added) rememberActiveStop(added.id);
              return next;
            });
          }}
          onOpenColorPicker={openColorPickerForStop}
          onDragEnd={finalizeStopDrag}
        />
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <div className="inspector-field-label mb-0">Stops</div>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              commit((prev) => {
                const next = insertStopAtPosition(prev, 50);
                const added = next.stops.find((s) => !prev.stops.some((o) => o.id === s.id));
                if (added) rememberActiveStop(added.id);
                return next;
              });
            }}
            className="flex h-6 items-center gap-0.5 rounded border border-app-border bg-app-panel px-1.5 text-ui text-app-muted hover:bg-app-hover hover:text-app-fg disabled:opacity-40"
          >
            <Plus className="h-3 w-3" strokeWidth={2} />
            Add
          </button>
        </div>
        <div className="space-y-3">
          {sortedStops.map((stop) => (
            <GradientStopRow
              key={stop.id}
              stop={stop}
              selected={selectedStopId === stop.id}
              disabled={disabled}
              canRemove={gradient.stops.length > 2}
              onSelect={() => rememberActiveStop(stop.id)}
              onOpenColorPicker={() => openColorPickerForStop(stop.id)}
              onChange={(patch, opts) => patchStop(stop.id, patch, opts)}
              onRemove={() => {
                commit((prev) => {
                  const next = removeStop(prev, stop.id);
                  if (!next) return prev;
                  rememberActiveStop(next.stops[0]?.id ?? null);
                  return next;
                });
              }}
            />
          ))}
        </div>
      </div>

      {colorPickerOpen && colorPickerStop && colorPickerBesideRef ? (
        <InspectorColorPickerAside
          open={colorPickerOpen}
          onClose={closeColorPicker}
          hostRef={colorPickerBesideRef}
          hostSide="left"
          title="Stop color"
          dataAttrs={{ "data-gradient-stop-color-picker": true }}
          hex={colorPickerStop.color}
          opacity={colorPickerStop.opacity ?? 1}
          disabled={disabled}
          onCommitHex={(hex, opts) => patchStop(colorPickerStop.id, { color: hex }, opts)}
          onCommitOpacity={(op, opts) => patchStop(colorPickerStop.id, { opacity: op }, opts)}
        />
      ) : null}

      {colorPickerOpen && colorPickerStop && !colorPickerBesideRef ? (
        <div className="rounded-lg border border-app-border bg-app-panel p-2">
          <div className="mb-2 flex items-center justify-between gap-2">
            <FieldLabel>Stop color</FieldLabel>
            <button
              type="button"
              className="rounded px-1.5 py-0.5 text-ui text-app-muted hover:bg-app-hover hover:text-app-fg"
              onClick={closeColorPicker}
            >
              Close
            </button>
          </div>
          <ColorPickerPanel
            hex={colorPickerStop.color}
            opacity={colorPickerStop.opacity ?? 1}
            disabled={disabled}
            onCommitHex={(hex, opts) => {
              patchStop(colorPickerStop.id, { color: hex }, opts);
            }}
            onCommitOpacity={(op, opts) => {
              patchStop(colorPickerStop.id, { opacity: op }, opts);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

/** @deprecated Use GradientFillEditor inline — kept for imports */
export function GradientEditorPanel(props: {
  gradient: FillGradient;
  fillOpacity: number;
  disabled?: boolean;
  onChange: (g: FillGradient, opts?: { skipHistory?: boolean }) => void;
  onClose: () => void;
  onCreateStyle?: () => void;
}) {
  const { onClose, ...rest } = props;
  return (
    <div>
      <GradientFillEditor {...rest} />
      <button
        type="button"
        onClick={onClose}
        className="mt-2 w-full rounded border border-app-border py-1 text-ui text-app-muted hover:bg-app-hover"
      >
        Close
      </button>
    </div>
  );
}
