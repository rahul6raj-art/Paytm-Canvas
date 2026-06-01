"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Library, Palette, Ruler, Sparkles, Type, Wand2 } from "lucide-react";
import { useEditorStore } from "@/stores/useEditorStore";
import {
  effectValueToCssShadow,
  isColorValue,
  isEffectValue,
  isGradientValue,
  isSpacingValue,
  isTypographyValue,
  tokenValueSummary,
  type DesignToken,
  type EffectTokenValue,
} from "@/lib/designTokens";
import { buildNodeEffectRenderStyle } from "@/lib/nodeEffects";
import { fillPaintCss, normalizeFillGradient } from "@/lib/fillGradient";
import { ColorInput } from "@/components/editor/ColorInput";
import { ColorLibrary } from "@/components/editor/ColorLibrary";
import { cn } from "@/lib/utils";

function EmptyStyleHint({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Palette;
  title: string;
  body: string;
}) {
  return (
    <div className="mx-1 rounded-lg border border-dashed border-white/[0.08] bg-white/[0.02] px-3 py-5 text-center">
      <Icon className="mx-auto mb-2 h-7 w-7 text-[#4a4a4a]" strokeWidth={1.25} />
      <p className="text-[12px] font-medium text-[#9a9a9a]">{title}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-[#6b6b6b]">{body}</p>
    </div>
  );
}

function groupByType(tokens: DesignToken[]) {
  const colors: DesignToken[] = [];
  const gradients: DesignToken[] = [];
  const typo: DesignToken[] = [];
  const spacing: DesignToken[] = [];
  const effects: DesignToken[] = [];
  for (const t of tokens) {
    if (t.type === "color") colors.push(t);
    else if (t.type === "gradient") gradients.push(t);
    else if (t.type === "typography") typo.push(t);
    else if (t.type === "spacing") spacing.push(t);
    else if (t.type === "effect") effects.push(t);
  }
  const byName = (a: DesignToken, b: DesignToken) => a.name.localeCompare(b.name);
  colors.sort(byName);
  gradients.sort(byName);
  typo.sort(byName);
  spacing.sort(byName);
  effects.sort(byName);
  return { colors, gradients, typo, spacing, effects };
}

function TokenPreview({ token }: { token: DesignToken }) {
  if (token.type === "color" && isColorValue(token.value)) {
    const v = token.value;
    const op = v.opacity ?? 1;
    return (
      <div
        className="h-8 w-full rounded border border-white/[0.12] shadow-inner"
        style={{ backgroundColor: v.hex, opacity: op }}
        title={tokenValueSummary(token)}
      />
    );
  }
  if (token.type === "gradient" && isGradientValue(token.value)) {
    return (
      <div
        className="h-8 w-full rounded border border-white/[0.12] shadow-inner"
        style={{
          background: fillPaintCss({
            fillType: "gradient",
            fillGradient: normalizeFillGradient(token.value),
            fillEnabled: true,
            fillOpacity: 1,
          }),
        }}
        title={tokenValueSummary(token)}
      />
    );
  }
  if (token.type === "typography" && isTypographyValue(token.value)) {
    const v = token.value;
    return (
      <div
        className="flex h-8 w-full items-center justify-center overflow-hidden rounded border border-white/[0.12] bg-[#1e1e1e] px-1"
        title={tokenValueSummary(token)}
      >
        <span
          className="truncate text-[11px] text-[#ececec]"
          style={{
            fontFamily: v.fontFamily,
            fontSize: Math.min(v.fontSize, 14),
            fontWeight: v.fontWeight,
            lineHeight: 1.1,
            letterSpacing: `${v.letterSpacing}px`,
          }}
        >
          Ag
        </span>
      </div>
    );
  }
  if (token.type === "spacing" && isSpacingValue(token.value)) {
    const px = Math.max(0, token.value.value);
    return (
      <div className="flex h-8 w-full items-center justify-center rounded border border-white/[0.12] bg-[#1e1e1e] px-2">
        <div className="h-2 flex-1 rounded bg-accent/40" style={{ width: `${Math.min(px, 72)}px`, maxWidth: "100%" }} />
        <span className="ml-2 shrink-0 font-mono text-[10px] text-[#9a9a9a]">{px}px</span>
      </div>
    );
  }
  if (token.type === "effect" && isEffectValue(token.value)) {
    const v = token.value as EffectTokenValue;
    const er = buildNodeEffectRenderStyle(v.effects, v.shadow?.trim() || undefined);
    const fallbackShadow = !er.boxShadow && !er.filter ? effectValueToCssShadow(v) : undefined;
    return (
      <div className="flex h-8 w-full items-center justify-center rounded border border-white/[0.12] bg-[#262626]">
        <div
          className="h-4 w-10 rounded-sm bg-white/[0.08]"
          style={{
            boxShadow: er.boxShadow ?? fallbackShadow,
            filter: er.filter || undefined,
          }}
          title={tokenValueSummary(token)}
        />
      </div>
    );
  }
  return <div className="h-8 w-full rounded border border-dashed border-white/[0.12] bg-[#1a1a1a]" />;
}

function TokenRow({ token }: { token: DesignToken }) {
  const applyTokenToSelection = useEditorStore((s) => s.applyTokenToSelection);
  const deleteDesignToken = useEditorStore((s) => s.deleteDesignToken);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const canApply = selectedIds.length > 0;

  return (
    <li className="rounded-md border border-white/[0.08] bg-[#2c2c2c] p-2">
      <TokenPreview token={token} />
      <p className="mt-1.5 truncate text-[12px] font-medium text-[#ececec]" title={token.name}>
        {token.name}
      </p>
      <p className="truncate font-mono text-[10px] text-[#737373]" title={tokenValueSummary(token)}>
        {tokenValueSummary(token)}
      </p>
      <div className="mt-1.5 flex gap-1">
        <button
          type="button"
          disabled={!canApply}
          onClick={() => applyTokenToSelection(token.id)}
          className={cn(
            "flex-1 rounded border py-1 text-[10px] font-semibold uppercase tracking-wide transition-colors",
            canApply
              ? "border-sky-500/40 bg-sky-500/15 text-sky-100 hover:bg-sky-500/25"
              : "cursor-not-allowed border-white/[0.06] text-[#5c5c5c]",
          )}
        >
          Apply
        </button>
        <button
          type="button"
          onClick={() => deleteDesignToken(token.id)}
          className="rounded border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-rose-100 hover:bg-rose-500/20"
        >
          Delete
        </button>
      </div>
    </li>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-3">
      <h3 className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6b6b6b]">
        {title}
      </h3>
      {children}
    </section>
  );
}

export function StylesPanel() {
  const designTokens = useEditorStore((s) => s.designTokens);
  const createColorToken = useEditorStore((s) => s.createColorToken);
  const createColorTokenFromSelection = useEditorStore((s) => s.createColorTokenFromSelection);
  const seedDesignSystemColorPalette = useEditorStore((s) => s.seedDesignSystemColorPalette);
  const createSpacingToken = useEditorStore((s) => s.createSpacingToken);
  const selectedIds = useEditorStore((s) => s.selectedIds);

  const [colorName, setColorName] = useState("Brand / Color");
  const [colorHex, setColorHex] = useState("#0d99ff");
  const [spaceName, setSpaceName] = useState("Spacing");
  const [spaceVal, setSpaceVal] = useState("16");

  const grouped = useMemo(() => groupByType(Object.values(designTokens)), [designTokens]);
  const hasColors = grouped.colors.length > 0;

  const addColor = () => {
    createColorToken(colorName, colorHex, 1);
  };

  const addSpacing = () => {
    const n = Number(spaceVal);
    if (!Number.isFinite(n)) return;
    createSpacingToken(spaceName.trim() || "Spacing", Math.max(0, n));
  };

  return (
    <div className="thin-scroll flex min-h-0 flex-1 flex-col overflow-y-auto p-2">
      <div className="mb-3 rounded-lg border border-white/[0.08] bg-[#262626] px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Library className="h-4 w-4 text-accent" strokeWidth={1.75} />
          <div>
            <p className="text-[12px] font-semibold text-[#ececec]">Design system</p>
            <p className="text-[10px] text-[#8c8c8c]">Reusable colors, type, and effects</p>
          </div>
        </div>
      </div>

      <Section title="Colors">
        {!hasColors ? (
          <div className="mb-2 space-y-2">
            <EmptyStyleHint
              icon={Palette}
              title="No colors yet"
              body="Add a starter palette or create your first color below. Then click a swatch to apply it to any selected layer."
            />
            <button
              type="button"
              onClick={() => seedDesignSystemColorPalette()}
              className="w-full rounded-lg border border-accent/40 bg-accent/15 py-2 text-[12px] font-semibold text-accent hover:bg-accent/25"
            >
              Add starter color palette
            </button>
          </div>
        ) : (
          <ColorLibrary variant="panel" className="mb-3 rounded-md border border-white/[0.08] bg-[#1e1e1e] p-2" />
        )}

        <div className="flex flex-col gap-2 rounded-md border border-white/[0.08] bg-[#262626] p-2">
          <p className="text-[10px] font-medium uppercase tracking-wide text-[#6b6b6b]">
            Create color
          </p>
          <label className="text-[10px] font-medium text-[#8c8c8c]">
            Name
            <input
              value={colorName}
              onChange={(e) => setColorName(e.target.value)}
              className="mt-0.5 w-full rounded border border-white/[0.1] bg-[#1e1e1e] px-1.5 py-1 text-[12px] text-[#ececec]"
            />
          </label>
          <ColorInput hex={colorHex} onCommitHex={setColorHex} />
          <div className="flex gap-1">
            <button
              type="button"
              onClick={addColor}
              className="flex-1 rounded border border-white/[0.12] bg-white/[0.06] py-1.5 text-[11px] font-medium text-white hover:bg-white/[0.1]"
            >
              Add to library
            </button>
            <button
              type="button"
              disabled={selectedIds.length === 0}
              onClick={() => createColorTokenFromSelection(colorName.trim() || undefined)}
              className="flex-1 rounded border border-white/[0.12] bg-white/[0.06] py-1.5 text-[11px] font-medium text-white hover:bg-white/[0.1] disabled:opacity-40"
              title="Save the selected layer's fill as a library color"
            >
              From selection
            </button>
          </div>
          {hasColors ? (
            <button
              type="button"
              onClick={() => seedDesignSystemColorPalette()}
              className="text-[10px] font-medium text-[#8c8c8c] underline-offset-2 hover:text-[#d4d4d4] hover:underline"
            >
              + Add more starter colors
            </button>
          ) : null}
        </div>

        {hasColors ? (
          <ul className="mt-2 space-y-1.5">
            {grouped.colors.map((t) => (
              <TokenRow key={t.id} token={t} />
            ))}
          </ul>
        ) : null}
      </Section>

      <Section title="New spacing token">
        <div className="flex flex-col gap-1.5 rounded-md border border-white/[0.08] bg-[#262626] p-2">
          <label className="text-[10px] font-medium text-[#8c8c8c]">
            Name
            <input
              value={spaceName}
              onChange={(e) => setSpaceName(e.target.value)}
              className="mt-0.5 w-full rounded border border-white/[0.1] bg-[#1e1e1e] px-1.5 py-1 text-[12px] text-[#ececec]"
            />
          </label>
          <label className="text-[10px] font-medium text-[#8c8c8c]">
            Value (px)
            <input
              type="number"
              min={0}
              value={spaceVal}
              onChange={(e) => setSpaceVal(e.target.value)}
              className="mt-0.5 w-full rounded border border-white/[0.1] bg-[#1e1e1e] px-1.5 py-1 text-[12px] text-[#ececec]"
            />
          </label>
          <button
            type="button"
            onClick={addSpacing}
            className="rounded border border-white/[0.12] bg-white/[0.06] py-1.5 text-[11px] font-medium text-white hover:bg-white/[0.1]"
          >
            Add spacing token
          </button>
        </div>
      </Section>

      <Section title="Gradients">
        {grouped.gradients.length === 0 ? (
          <EmptyStyleHint
            icon={Sparkles}
            title="No gradient styles"
            body="Select a shape with a gradient fill, then use Create gradient style in the Design inspector."
          />
        ) : (
          <ul className="space-y-1.5">
            {grouped.gradients.map((t) => (
              <TokenRow key={t.id} token={t} />
            ))}
          </ul>
        )}
      </Section>

      <Section title="Typography">
        {grouped.typo.length === 0 ? (
          <EmptyStyleHint
            icon={Type}
            title="No text styles"
            body="Select a text layer and create a typography style from the inspector."
          />
        ) : (
          <ul className="space-y-1.5">
            {grouped.typo.map((t) => (
              <TokenRow key={t.id} token={t} />
            ))}
          </ul>
        )}
      </Section>

      <Section title="Spacing tokens">
        {grouped.spacing.length === 0 ? (
          <EmptyStyleHint
            icon={Ruler}
            title="No spacing tokens"
            body="Define spacing scales above for padding and layout gaps."
          />
        ) : (
          <ul className="space-y-1.5">
            {grouped.spacing.map((t) => (
              <TokenRow key={t.id} token={t} />
            ))}
          </ul>
        )}
      </Section>

      <Section title="Effects">
        {grouped.effects.length === 0 ? (
          <EmptyStyleHint
            icon={Wand2}
            title="No effect styles"
            body="Build shadows on a layer, then create an effect style from the Design inspector."
          />
        ) : (
          <ul className="space-y-1.5">
            {grouped.effects.map((t) => (
              <TokenRow key={t.id} token={t} />
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
