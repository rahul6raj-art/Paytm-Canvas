"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import {
  clamp01,
  colorToCssString,
  hexToHsl,
  hexToHsv,
  hexToRgb,
  hslToRgb,
  hsvToHex,
  normalizeHex,
  parseCssColor,
  parseHexInputLive,
  rgbToHex,
} from "@/lib/color";
import { handlePanelFieldKeyDown, keyboardNudgeStep } from "@/lib/panelFieldKeyboard";
import { useInspectorValueScrub } from "@/lib/useInspectorValueScrub";
import { appFieldClass } from "@/lib/appFieldStyles";
import { cn } from "@/lib/utils";
import { useDismissAnchoredDropdown } from "./useAnchoredDropdown";

export type ColorFormat = "hex" | "rgb" | "css" | "hsl" | "hsb";

const FORMAT_OPTIONS: { value: ColorFormat; label: string }[] = [
  { value: "hex", label: "Hex" },
  { value: "rgb", label: "RGB" },
  { value: "css", label: "CSS" },
  { value: "hsl", label: "HSL" },
  { value: "hsb", label: "HSB" },
];

const channelField = cn(appFieldClass, "h-8 min-h-8 px-2 text-center font-mono tabular-nums");

type ColorFormatFieldsProps = {
  hex: string;
  opacity: number;
  disabled?: boolean;
  onCommitHex: (hex: string, opts?: { skipHistory?: boolean }) => void;
  onCommitOpacity: (opacity: number, opts?: { skipHistory?: boolean }) => void;
};

function clampChannel(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(n)));
}

function hexToDisplay(hex: string): string {
  return (normalizeHex(hex) ?? "#888888").slice(1).toUpperCase();
}

export function ColorFormatFields({
  hex,
  opacity,
  disabled,
  onCommitHex,
  onCommitOpacity,
}: ColorFormatFieldsProps) {
  const safeHex = normalizeHex(hex) ?? "#888888";
  const [format, setFormat] = useState<ColorFormat>("hex");
  const [formatMenuOpen, setFormatMenuOpen] = useState(false);
  const formatBtnRef = useRef<HTMLButtonElement>(null);
  const formatMenuRef = useRef<HTMLDivElement>(null);
  useDismissAnchoredDropdown(formatMenuOpen, () => setFormatMenuOpen(false), formatBtnRef, formatMenuRef);

  const [hexText, setHexText] = useState(() => hexToDisplay(safeHex));
  const [rgbText, setRgbText] = useState(() => {
    const rgb = hexToRgb(safeHex);
    return rgb ? `${rgb.r}, ${rgb.g}, ${rgb.b}` : "136, 136, 136";
  });
  const [cssText, setCssText] = useState(() => colorToCssString(safeHex, opacity));
  const [hslText, setHslText] = useState(() => {
    const hsl = hexToHsl(safeHex);
    return `${Math.round(hsl.h)}, ${Math.round(hsl.s * 100)}, ${Math.round(hsl.l * 100)}`;
  });
  const [hsbText, setHsbText] = useState(() => {
    const hsv = hexToHsv(safeHex);
    return `${Math.round(hsv.h)}, ${Math.round(hsv.s * 100)}, ${Math.round(hsv.v * 100)}`;
  });
  const [opacityText, setOpacityText] = useState(() => String(Math.round(clamp01(opacity) * 100)));
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const opacityPercent = Math.round(clamp01(opacity) * 100);

  const commitOpacityPercent = (n: number, skipHistory = false) => {
    const clamped = clampChannel(n, 0, 100);
    onCommitOpacity(clamped / 100, { skipHistory });
    setOpacityText(String(clamped));
    if (focusedField !== "css") setCssText(colorToCssString(safeHex, clamped / 100));
    return clamped;
  };

  const { scrubbing, scrubActiveRef, bindScrubInput } = useInspectorValueScrub({
    disabled,
    value: opacityPercent,
    min: 0,
    max: 100,
    onChange: (n) => {
      commitOpacityPercent(n, true);
    },
  });

  const syncFromColor = (nextHex: string, nextOpacity: number) => {
    const n = normalizeHex(nextHex) ?? safeHex;
    const rgb = hexToRgb(n);
    const hsl = hexToHsl(n);
    const hsv = hexToHsv(n);
    const a = clamp01(nextOpacity);
    if (focusedField !== "hex") setHexText(hexToDisplay(n));
    if (focusedField !== "rgb") {
      setRgbText(rgb ? `${rgb.r}, ${rgb.g}, ${rgb.b}` : "136, 136, 136");
    }
    if (focusedField !== "css") setCssText(colorToCssString(n, a));
    if (focusedField !== "hsl") {
      setHslText(`${Math.round(hsl.h)}, ${Math.round(hsl.s * 100)}, ${Math.round(hsl.l * 100)}`);
    }
    if (focusedField !== "hsb") {
      setHsbText(`${Math.round(hsv.h)}, ${Math.round(hsv.s * 100)}, ${Math.round(hsv.v * 100)}`);
    }
    if (focusedField !== "opacity") setOpacityText(String(Math.round(a * 100)));
  };

  useEffect(() => {
    if (focusedField) return;
    if (scrubbing || scrubActiveRef.current) return;
    syncFromColor(hex, opacity);
  }, [hex, opacity, focusedField, scrubbing, scrubActiveRef]);

  const commitHex = (next: string, skipHistory = false) => {
    const normalized = normalizeHex(next) ?? parseHexInputLive(next);
    if (!normalized) return false;
    onCommitHex(normalized, { skipHistory });
    syncFromColor(normalized, clamp01(opacity));
    return true;
  };

  const commitRgbChannels = (r: number, g: number, b: number, skipHistory = false) => {
    commitHex(rgbToHex(r, g, b), skipHistory);
    return true;
  };

  const commitHslChannels = (h: number, s: number, l: number, skipHistory = false) => {
    const rgb = hslToRgb(h, s / 100, l / 100);
    return commitRgbChannels(rgb.r, rgb.g, rgb.b, skipHistory);
  };

  const commitHsbChannels = (h: number, s: number, b: number, skipHistory = false) => {
    commitHex(hsvToHex(h, s / 100, b / 100), skipHistory);
    return true;
  };

  const commitOpacity = (raw: string, skipHistory = false) => {
    const digits = raw.replace(/%/g, "").trim();
    if (!digits) return false;
    const n = parseInt(digits, 10);
    if (!Number.isFinite(n)) return false;
    commitOpacityPercent(n, skipHistory);
    return true;
  };

  const parseTriple = (raw: string): [number, number, number] | null => {
    const parts = raw.split(/[\s,]+/).filter(Boolean);
    if (parts.length < 3) return null;
    const nums = parts.slice(0, 3).map((p) => parseFloat(p.replace(/%/g, "")));
    if (!nums.every(Number.isFinite)) return null;
    return [nums[0]!, nums[1]!, nums[2]!];
  };

  const renderTripleFields = (
    key: "rgb" | "hsl" | "hsb",
    labels: [string, string, string],
    values: [string, string, string],
    onChange: (idx: 0 | 1 | 2, raw: string) => void,
    onCommit: () => void,
  ) => (
    <div className="grid min-w-0 flex-1 grid-cols-3 gap-1.5">
      {labels.map((label, idx) => (
        <div key={label} className="min-w-0">
          <label className="mb-0.5 block text-center text-[10px] font-medium uppercase tracking-wide text-app-subtle">
            {label}
          </label>
          <input
            type="text"
            inputMode="numeric"
            disabled={disabled}
            aria-label={`${key.toUpperCase()} ${label}`}
            className={channelField}
            value={values[idx]}
            onFocus={() => setFocusedField(key)}
            onChange={(e) => onChange(idx as 0 | 1 | 2, e.target.value)}
            onBlur={() => {
              setFocusedField(null);
              onCommit();
            }}
            onKeyDown={(e) => {
              handlePanelFieldKeyDown(e, {
                onEnter: () => {
                  onCommit();
                  e.currentTarget.blur();
                },
              });
            }}
          />
        </div>
      ))}
    </div>
  );

  const rgbParts = rgbText.split(/[\s,]+/).filter(Boolean);
  const hslParts = hslText.split(/[\s,]+/).filter(Boolean);
  const hsbParts = hsbText.split(/[\s,]+/).filter(Boolean);

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-2">
        <div className="relative shrink-0">
          <button
            ref={formatBtnRef}
            type="button"
            disabled={disabled}
            aria-haspopup="listbox"
            aria-expanded={formatMenuOpen}
            aria-label="Color format"
            onClick={() => setFormatMenuOpen((o) => !o)}
            className={cn(
              channelField,
              "flex h-8 min-w-[4.5rem] items-center justify-between gap-1 px-2.5 text-left font-medium normal-case",
            )}
          >
            {FORMAT_OPTIONS.find((o) => o.value === format)?.label ?? "Hex"}
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
          </button>
          {formatMenuOpen ? (
            <div
              ref={formatMenuRef}
              role="listbox"
              aria-label="Color format"
              className="absolute left-0 top-full z-20 mt-1 min-w-full overflow-hidden rounded-md border border-app-border bg-app-panel py-1 shadow-lg"
            >
              {FORMAT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={format === opt.value}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-left text-ui text-app-fg hover:bg-app-hover",
                    format === opt.value && "bg-accent/10",
                  )}
                  onClick={() => {
                    setFormat(opt.value);
                    setFormatMenuOpen(false);
                    syncFromColor(safeHex, opacity);
                  }}
                >
                  <Check
                    className={cn("h-3.5 w-3.5 shrink-0", format === opt.value ? "opacity-100" : "opacity-0")}
                    strokeWidth={2}
                    aria-hidden
                  />
                  {opt.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-1 items-end gap-1.5">
          {format === "hex" ? (
            <input
              type="text"
              disabled={disabled}
              spellCheck={false}
              autoComplete="off"
              aria-label="Hex color code"
              className={cn(channelField, "flex-1 text-left uppercase")}
              value={hexText}
              onFocus={() => setFocusedField("hex")}
              onChange={(e) => {
                const next = e.target.value.replace(/[^0-9a-fA-F]/gi, "").slice(0, 6).toUpperCase();
                setHexText(next);
                const live = parseHexInputLive(next) ?? normalizeHex(`#${next}`);
                if (live) commitHex(live, true);
              }}
              onBlur={() => {
                setFocusedField(null);
                if (!commitHex(`#${hexText}`, true)) setHexText(hexToDisplay(safeHex));
              }}
              onKeyDown={(e) => {
                handlePanelFieldKeyDown(e, {
                  onEnter: () => {
                    commitHex(`#${hexText}`);
                    e.currentTarget.blur();
                  },
                });
              }}
            />
          ) : null}

          {format === "css" ? (
            <input
              type="text"
              disabled={disabled}
              spellCheck={false}
              aria-label="CSS color"
              className={cn(channelField, "flex-1 text-left font-mono normal-case")}
              value={cssText}
              onFocus={() => setFocusedField("css")}
              onChange={(e) => {
                setCssText(e.target.value);
                const parsed = parseCssColor(e.target.value);
                if (parsed) {
                  commitHex(parsed.hex, true);
                  if (parsed.opacity != null) onCommitOpacity(clamp01(parsed.opacity), { skipHistory: true });
                }
              }}
              onBlur={() => {
                setFocusedField(null);
                const parsed = parseCssColor(cssText);
                if (parsed) {
                  commitHex(parsed.hex, true);
                  if (parsed.opacity != null) commitOpacity(String(Math.round(parsed.opacity * 100)), true);
                } else {
                  setCssText(colorToCssString(safeHex, opacity));
                }
              }}
            />
          ) : null}

          {format === "rgb"
            ? renderTripleFields(
                "rgb",
                ["R", "G", "B"],
                [
                  rgbParts[0] ?? "0",
                  rgbParts[1] ?? "0",
                  rgbParts[2] ?? "0",
                ],
                (idx, raw) => {
                  const parts = [...rgbParts];
                  parts[idx] = raw.replace(/[^\d]/g, "").slice(0, 3);
                  setRgbText(parts.join(", "));
                  const triple = parseTriple(parts.join(", "));
                  if (triple) commitRgbChannels(triple[0], triple[1], triple[2], true);
                },
                () => {
                  const triple = parseTriple(rgbText);
                  if (triple) commitRgbChannels(triple[0], triple[1], triple[2], true);
                  else syncFromColor(safeHex, opacity);
                },
              )
            : null}

          {format === "hsl"
            ? renderTripleFields(
                "hsl",
                ["H", "S", "L"],
                [
                  hslParts[0] ?? "0",
                  hslParts[1] ?? "0",
                  hslParts[2] ?? "0",
                ],
                (idx, raw) => {
                  const parts = [...hslParts];
                  parts[idx] = raw.replace(/[^\d]/g, "").slice(0, 3);
                  setHslText(parts.join(", "));
                  const triple = parseTriple(parts.join(", "));
                  if (triple) commitHslChannels(triple[0], triple[1], triple[2], true);
                },
                () => {
                  const triple = parseTriple(hslText);
                  if (triple) commitHslChannels(triple[0], triple[1], triple[2], true);
                  else syncFromColor(safeHex, opacity);
                },
              )
            : null}

          {format === "hsb"
            ? renderTripleFields(
                "hsb",
                ["H", "S", "B"],
                [
                  hsbParts[0] ?? "0",
                  hsbParts[1] ?? "0",
                  hsbParts[2] ?? "0",
                ],
                (idx, raw) => {
                  const parts = [...hsbParts];
                  parts[idx] = raw.replace(/[^\d]/g, "").slice(0, 3);
                  setHsbText(parts.join(", "));
                  const triple = parseTriple(parts.join(", "));
                  if (triple) commitHsbChannels(triple[0], triple[1], triple[2], true);
                },
                () => {
                  const triple = parseTriple(hsbText);
                  if (triple) commitHsbChannels(triple[0], triple[1], triple[2], true);
                  else syncFromColor(safeHex, opacity);
                },
              )
            : null}
        </div>

        <div className="w-[3.25rem] shrink-0">
          <label className="mb-0.5 block text-center text-[10px] font-medium uppercase tracking-wide text-app-subtle">
            %
          </label>
          <input
            type="text"
            inputMode="numeric"
            disabled={disabled}
            aria-label="Opacity percent"
            {...bindScrubInput(cn(channelField, "w-full"), focusedField === "opacity")}
            value={opacityText}
            onFocus={() => setFocusedField("opacity")}
            onChange={(e) => {
              const next = e.target.value.replace(/[^\d]/g, "").slice(0, 3);
              setOpacityText(next);
              if (next !== "") {
                const n = parseInt(next, 10);
                if (Number.isFinite(n)) commitOpacityPercent(n, true);
              }
            }}
            onBlur={() => {
              if (scrubActiveRef.current) return;
              setFocusedField(null);
              if (!commitOpacity(opacityText, true)) {
                setOpacityText(String(opacityPercent));
              }
            }}
            onKeyDown={(e) => {
              handlePanelFieldKeyDown(e, {
                onEnter: () => {
                  if (!commitOpacity(opacityText, true)) {
                    setOpacityText(String(opacityPercent));
                  }
                  e.currentTarget.blur();
                },
                onArrowNudge: (dir, shift, alt) => {
                  const step = keyboardNudgeStep(1, 0, shift, alt) * dir;
                  const current = parseInt(opacityText, 10);
                  const base = Number.isFinite(current) ? current : opacityPercent;
                  commitOpacityPercent(base + step, true);
                },
              });
            }}
          />
        </div>
      </div>
    </div>
  );
}
