"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Pipette } from "lucide-react";
import {
  clamp01,
  fillCss,
  hexToHsv,
  hsvToHex,
  hsvToRgb,
  normalizeHex,
  type HsvColor,
} from "@/lib/color";
import { cn } from "@/lib/utils";
import { ColorFormatFields } from "./ColorFormatFields";

const CHECKERBOARD =
  "linear-gradient(45deg, #808080 25%, transparent 25%), linear-gradient(-45deg, #808080 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #808080 75%), linear-gradient(-45deg, transparent 75%, #808080 75%)";

const SLIDER_TRACK = "relative h-5 min-h-5 w-full cursor-pointer rounded-full border border-app-border";
const SLIDER_TRACK_FILL = "pointer-events-none absolute inset-0 overflow-hidden rounded-full";
const SLIDER_THUMB =
  "pointer-events-none absolute top-1/2 z-10 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md ring-1 ring-black/10";

type ColorPickerPanelProps = {
  hex: string;
  opacity: number;
  disabled?: boolean;
  onCommitHex: (hex: string, opts?: { skipHistory?: boolean }) => void;
  onCommitOpacity: (opacity: number, opts?: { skipHistory?: boolean }) => void;
};

function bindPointerDrag(
  onMove: (clientX: number, clientY: number) => void,
  onEnd?: () => void,
) {
  const onPointerMove = (ev: PointerEvent) => onMove(ev.clientX, ev.clientY);
  const onPointerUp = () => {
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerUp);
    onEnd?.();
  };
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);
}

export function ColorPickerPanel({
  hex,
  opacity,
  disabled,
  onCommitHex,
  onCommitOpacity,
}: ColorPickerPanelProps) {
  const safeHex = normalizeHex(hex) ?? "#888888";
  const [hsv, setHsv] = useState<HsvColor>(() => hexToHsv(safeHex));
  const [alpha, setAlpha] = useState(() => clamp01(opacity));
  const svRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const alphaTrackRef = useRef<HTMLDivElement>(null);
  const hsvRef = useRef(hsv);
  const alphaValueRef = useRef(alpha);
  const liveRef = useRef(false);

  useEffect(() => {
    const n = normalizeHex(hex) ?? "#888888";
    const nextHsv = hexToHsv(n);
    const nextAlpha = clamp01(opacity);
    setHsv(nextHsv);
    setAlpha(nextAlpha);
    hsvRef.current = nextHsv;
    alphaValueRef.current = nextAlpha;
  }, [hex, opacity]);

  const commit = useCallback(
    (nextHsv: HsvColor, nextAlpha: number, skipHistory = false) => {
      hsvRef.current = nextHsv;
      alphaValueRef.current = nextAlpha;
      setHsv(nextHsv);
      setAlpha(nextAlpha);
      onCommitHex(hsvToHex(nextHsv.h, nextHsv.s, nextHsv.v), { skipHistory });
      onCommitOpacity(nextAlpha, { skipHistory });
    },
    [onCommitHex, onCommitOpacity],
  );

  const finishLive = () => {
    if (!liveRef.current) return;
    liveRef.current = false;
    onCommitHex(hsvToHex(hsvRef.current.h, hsvRef.current.s, hsvRef.current.v));
    onCommitOpacity(alphaValueRef.current);
  };

  const onSvPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.preventDefault();
    const el = svRef.current;
    if (!el) return;
    liveRef.current = true;
    const update = (clientX: number, clientY: number) => {
      const rect = el.getBoundingClientRect();
      const s = clamp01((clientX - rect.left) / rect.width);
      const v = clamp01(1 - (clientY - rect.top) / rect.height);
      commit({ ...hsvRef.current, s, v }, alphaValueRef.current, true);
    };
    update(e.clientX, e.clientY);
    bindPointerDrag(update, finishLive);
  };

  const onHuePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.preventDefault();
    const el = hueRef.current;
    if (!el) return;
    liveRef.current = true;
    const update = (clientX: number) => {
      const rect = el.getBoundingClientRect();
      const h = clamp01((clientX - rect.left) / rect.width) * 360;
      commit({ ...hsvRef.current, h }, alphaValueRef.current, true);
    };
    update(e.clientX);
    bindPointerDrag((x) => update(x), finishLive);
  };

  const onAlphaPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.preventDefault();
    const el = alphaTrackRef.current;
    if (!el) return;
    liveRef.current = true;
    const update = (clientX: number) => {
      const rect = el.getBoundingClientRect();
      const nextAlpha = clamp01((clientX - rect.left) / rect.width);
      commit(hsvRef.current, nextAlpha, true);
    };
    update(e.clientX);
    bindPointerDrag((x) => update(x), finishLive);
  };

  const pickEyedropper = async () => {
    if (disabled || typeof window === "undefined") return;
    const EyeDropper = (window as Window & { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } })
      .EyeDropper;
    if (!EyeDropper) return;
    try {
      const result = await new EyeDropper().open();
      const next = normalizeHex(result.sRGBHex);
      if (!next) return;
      commit(hexToHsv(next), alpha);
    } catch {
      /* cancelled */
    }
  };

  const hueRgb = hsvToRgb(hsv.h, 1, 1);
  const hueColor = `rgb(${hueRgb.r},${hueRgb.g},${hueRgb.b})`;
  const preview = fillCss(safeHex, alpha, true);

  return (
    <div className={cn("space-y-3", disabled && "pointer-events-none opacity-50")}>
      <div
        ref={svRef}
        role="slider"
        aria-label="Saturation and brightness"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(hsv.s * 100)}
        tabIndex={disabled ? -1 : 0}
        className="relative h-40 w-full cursor-crosshair overflow-hidden rounded-lg border border-app-border touch-none"
        style={{
          background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueColor})`,
        }}
        onPointerDown={onSvPointerDown}
      >
        <span
          className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md"
          style={{
            left: `${hsv.s * 100}%`,
            top: `${(1 - hsv.v) * 100}%`,
          }}
        />
      </div>

      <div className="flex items-center gap-2.5">
        <button
          type="button"
          title="Eyedropper"
          aria-label="Pick color from screen"
          disabled={disabled || typeof window === "undefined" || !("EyeDropper" in window)}
          onClick={() => void pickEyedropper()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-app-border text-app-muted transition-colors hover:bg-app-hover hover:text-app-fg disabled:opacity-35"
        >
          <Pipette className="h-4 w-4" strokeWidth={1.75} />
        </button>
        <div className="min-w-0 flex-1 space-y-2.5">
          <div
            ref={hueRef}
            role="slider"
            aria-label="Hue"
            aria-valuemin={0}
            aria-valuemax={360}
            aria-valuenow={Math.round(hsv.h)}
            tabIndex={disabled ? -1 : 0}
            className={cn(SLIDER_TRACK, "touch-none")}
            style={{
              background:
                "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
            }}
            onPointerDown={onHuePointerDown}
          >
            <span
              className={SLIDER_THUMB}
              style={{
                left: `${(hsv.h / 360) * 100}%`,
                backgroundColor: hueColor,
              }}
            />
          </div>
          <div
            ref={alphaTrackRef}
            role="slider"
            aria-label="Opacity"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(alpha * 100)}
            tabIndex={disabled ? -1 : 0}
            className={cn(SLIDER_TRACK, "touch-none")}
            onPointerDown={onAlphaPointerDown}
          >
            <div
              className={SLIDER_TRACK_FILL}
              style={{
                backgroundColor: "#808080",
                backgroundImage: `${CHECKERBOARD}`,
                backgroundSize: "10px 10px",
                backgroundPosition: "0 0, 0 5px, 5px -5px, -5px 0",
              }}
            >
              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(to right, transparent, ${preview})`,
                }}
              />
            </div>
            <span
              className={cn(SLIDER_THUMB, "bg-white")}
              style={{ left: `${alpha * 100}%` }}
            />
          </div>
        </div>
      </div>

      <ColorFormatFields
        hex={safeHex}
        opacity={alpha}
        disabled={disabled}
        onCommitHex={(h, opts) => {
          const nextHsv = hexToHsv(h);
          commit(nextHsv, alphaValueRef.current, opts?.skipHistory);
        }}
        onCommitOpacity={(op, opts) => {
          commit(hsvRef.current, op, opts?.skipHistory);
        }}
      />
    </div>
  );
}
