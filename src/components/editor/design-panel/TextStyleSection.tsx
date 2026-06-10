"use client";

import type { ReactNode } from "react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  List,
  ListOrdered,
  Minus,
  Strikethrough,
  Underline,
} from "lucide-react";
import { appFieldClass } from "@/lib/appFieldStyles";
import { handlePanelFieldKeyDown } from "@/lib/panelFieldKeyboard";
import { cn } from "@/lib/utils";
import type { EditorNode, NodeStylePatch } from "@/stores/useEditorStore";
import type {
  TextCaseMode,
  TextDecorationMode,
  TextListStyle,
  TextTruncateMode,
  TextVerticalTrim,
} from "@/lib/text/textAdvancedStyle";
import type { TextAlign } from "@/lib/text/textNodeModel";

function IconToggleGroup<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: readonly { value: T; label: string; title: string; icon: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex rounded-md border border-app-border bg-app-inset p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          title={opt.title}
          aria-label={opt.label}
          disabled={disabled}
          onClick={() => onChange(opt.value)}
          className={cn(
            "flex h-6 min-w-[26px] flex-1 items-center justify-center rounded-[5px] text-app-muted transition-colors disabled:opacity-40",
            value === opt.value
              ? "bg-app-panel text-app-fg shadow-sm"
              : "hover:bg-app-hover hover:text-app-fg",
          )}
        >
          {opt.icon}
        </button>
      ))}
    </div>
  );
}

function StyleRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-[88px] shrink-0 text-[11px] font-medium text-app-subtle">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function CaseIcon({ mode }: { mode: "none" | "upper" | "lower" | "title" | "small-caps" }) {
  const className = "text-[10px] font-semibold leading-none tracking-tight";
  switch (mode) {
    case "upper":
      return <span className={className}>AG</span>;
    case "lower":
      return <span className={className}>ag</span>;
    case "title":
      return <span className={className}>Ag</span>;
    case "small-caps":
      return <span className={cn(className, "text-[8px]")}>AG</span>;
    default:
      return <Minus className="h-3.5 w-3.5" strokeWidth={2} />;
  }
}

function VerticalTrimIcon({ mode }: { mode: TextVerticalTrim }) {
  if (mode === "cap-height") {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden className="text-current">
        <line x1="2" y1="3" x2="12" y2="3" stroke="currentColor" strokeWidth="1.2" />
        <line x1="2" y1="11" x2="12" y2="11" stroke="currentColor" strokeWidth="1.2" />
        <text x="4" y="9.5" fontSize="6" fill="currentColor" fontFamily="system-ui">
          Ag
        </text>
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden className="text-current">
      <line x1="2" y1="11.5" x2="12" y2="11.5" stroke="currentColor" strokeWidth="1.2" />
      <text x="4" y="9.5" fontSize="6" fill="currentColor" fontFamily="system-ui">
        Ag
      </text>
    </svg>
  );
}

function TruncateIcon({ mode }: { mode: TextTruncateMode }) {
  if (mode === "end") {
    return <span className="text-[10px] font-semibold leading-none">A…</span>;
  }
  return <Minus className="h-3.5 w-3.5" strokeWidth={2} />;
}

const ALIGN_OPTIONS: readonly {
  value: TextAlign;
  label: string;
  title: string;
  icon: ReactNode;
}[] = [
  { value: "left", label: "Align left", title: "Align left", icon: <AlignLeft className="h-3.5 w-3.5" strokeWidth={2} /> },
  { value: "center", label: "Align center", title: "Align center", icon: <AlignCenter className="h-3.5 w-3.5" strokeWidth={2} /> },
  { value: "right", label: "Align right", title: "Align right", icon: <AlignRight className="h-3.5 w-3.5" strokeWidth={2} /> },
  { value: "justify", label: "Justify", title: "Justify", icon: <AlignJustify className="h-3.5 w-3.5" strokeWidth={2} /> },
];

export function TextStyleSection({
  node,
  instanceKey,
  locked,
  onPatch,
}: {
  node: EditorNode;
  instanceKey: string;
  locked: boolean;
  onPatch: (p: NodeStylePatch) => void;
}) {
  const textDecoration = node.textDecoration ?? "none";
  const textCase = node.textCase ?? "none";
  const verticalTrim = node.verticalTrim ?? "standard";
  const listStyle = node.listStyle ?? "none";
  const textTruncate = node.textTruncate ?? "none";

  return (
    <div className="mt-1.5 space-y-2">
      <StyleRow label="Alignment">
        <IconToggleGroup
          options={ALIGN_OPTIONS}
          value={node.textAlign ?? "left"}
          onChange={(v) => onPatch({ textAlign: v })}
          disabled={locked}
        />
      </StyleRow>

      <StyleRow label="Decoration">
        <IconToggleGroup<TextDecorationMode>
          options={[
            { value: "none", label: "None", title: "No decoration", icon: <Minus className="h-3.5 w-3.5" strokeWidth={2} /> },
            { value: "underline", label: "Underline", title: "Underline", icon: <Underline className="h-3.5 w-3.5" strokeWidth={2} /> },
            { value: "strikethrough", label: "Strikethrough", title: "Strikethrough", icon: <Strikethrough className="h-3.5 w-3.5" strokeWidth={2} /> },
          ]}
          value={textDecoration}
          onChange={(v) => onPatch({ textDecoration: v })}
          disabled={locked}
        />
      </StyleRow>

      <StyleRow label="Case">
        <IconToggleGroup<TextCaseMode>
          options={[
            { value: "none", label: "Original", title: "As typed", icon: <CaseIcon mode="none" /> },
            { value: "upper", label: "Uppercase", title: "Uppercase", icon: <CaseIcon mode="upper" /> },
            { value: "lower", label: "Lowercase", title: "Lowercase", icon: <CaseIcon mode="lower" /> },
            { value: "title", label: "Title case", title: "Title case", icon: <CaseIcon mode="title" /> },
            { value: "small-caps", label: "Small caps", title: "Small caps", icon: <CaseIcon mode="small-caps" /> },
          ]}
          value={textCase}
          onChange={(v) => onPatch({ textCase: v })}
          disabled={locked}
        />
      </StyleRow>

      <div className="border-t border-app-border pt-2" />

      <StyleRow label="Vertical trim">
        <IconToggleGroup<TextVerticalTrim>
          options={[
            { value: "standard", label: "Standard", title: "Standard line box", icon: <VerticalTrimIcon mode="standard" /> },
            { value: "cap-height", label: "Cap height", title: "Trim to cap height", icon: <VerticalTrimIcon mode="cap-height" /> },
          ]}
          value={verticalTrim}
          onChange={(v) => onPatch({ verticalTrim: v })}
          disabled={locked}
        />
      </StyleRow>

      <StyleRow label="List style">
        <IconToggleGroup<TextListStyle>
          options={[
            { value: "none", label: "None", title: "No list", icon: <Minus className="h-3.5 w-3.5" strokeWidth={2} /> },
            { value: "bullet", label: "Bulleted", title: "Bulleted list", icon: <List className="h-3.5 w-3.5" strokeWidth={2} /> },
            { value: "numbered", label: "Numbered", title: "Numbered list", icon: <ListOrdered className="h-3.5 w-3.5" strokeWidth={2} /> },
          ]}
          value={listStyle}
          onChange={(v) => onPatch({ listStyle: v })}
          disabled={locked}
        />
      </StyleRow>

      <StyleRow label="Paragraph spacing">
        <input
          type="text"
          inputMode="numeric"
          disabled={locked}
          className={cn(appFieldClass, "w-full font-mono tabular-nums")}
          defaultValue={String(node.paragraphSpacing ?? 0)}
          key={`${instanceKey}-para-spacing-${node.paragraphSpacing ?? 0}`}
          onBlur={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) onPatch({ paragraphSpacing: Math.max(0, Math.round(n)) });
          }}
          onKeyDown={(e) => {
            handlePanelFieldKeyDown(e, {
              onEnter: () => e.currentTarget.blur(),
            });
          }}
        />
      </StyleRow>

      <StyleRow label="Truncate text">
        <IconToggleGroup<TextTruncateMode>
          options={[
            { value: "none", label: "None", title: "No truncation", icon: <TruncateIcon mode="none" /> },
            { value: "end", label: "Truncate", title: "Truncate with ellipsis", icon: <TruncateIcon mode="end" /> },
          ]}
          value={textTruncate}
          onChange={(v) => onPatch({ textTruncate: v })}
          disabled={locked}
        />
      </StyleRow>
    </div>
  );
}
