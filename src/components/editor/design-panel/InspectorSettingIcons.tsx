"use client";

/**
 * Inspector property glyphs aligned with Figma's right-panel iconography.
 *
 * Sources (researched + traced from open references):
 * - Penpot design-tool icons (Figma-parity UI): rotation, flip, corner radius,
 *   auto-layout direction, padding sides, text resize, text alignment, layer alignment
 *   https://github.com/penpot/penpot/tree/develop/frontend/resources/images/icons
 * - Lucide (ISC): rotate-90°, shadow X/Y offset arrows
 *   https://lucide.dev
 */
import { useId, type ReactNode } from "react";
import { inspectorInlineSvgClass } from "@/lib/inspectorIconStyles";
import { cn } from "@/lib/utils";

/** Penpot / Figma inspector strokes read thinner than generic Lucide at 16px. */
const PENPOT_STROKE = 1.5;
const LUCIDE_STROKE = 2;

/** Shared SVG shell for crisp inspector property / transform glyphs. */
function SettingIconSvg({
  children,
  className,
  viewBox = "0 0 16 16",
}: {
  children: ReactNode;
  className?: string;
  viewBox?: string;
}) {
  return (
    <svg
      viewBox={viewBox}
      aria-hidden
      className={inspectorInlineSvgClass(className)}
      fill="none"
      shapeRendering="geometricPrecision"
    >
      {children}
    </svg>
  );
}

/** Rotation field — Penpot `rotation.svg` (L-bracket + arc). */
export function RotationAngleIcon({ className }: { className?: string }) {
  return (
    <SettingIconSvg className={className}>
      <path
        d="m2 2v6 6h6 6m-6 0c0-3.314-2.686-6-6-6"
        stroke="currentColor"
        strokeWidth={PENPOT_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </SettingIconSvg>
  );
}

/** Rotate 90° — Lucide `rotate-ccw-square` (portrait tile + arc arrow). */
export function Rotate90Icon({ className }: { className?: string }) {
  return (
    <SettingIconSvg className={className} viewBox="0 0 24 24">
      <path
        d="M20 9V7a2 2 0 0 0-2-2h-6"
        stroke="currentColor"
        strokeWidth={LUCIDE_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m15 2l-3 3l3 3m5 5v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2"
        stroke="currentColor"
        strokeWidth={LUCIDE_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </SettingIconSvg>
  );
}

/** Flip horizontal — Penpot `flip-horizontal.svg` (filled chevrons). */
export function FlipHorizontalIcon({ className }: { className?: string }) {
  return (
    <SettingIconSvg className={className}>
      <path d="m9.5 13h5.5l-5.5-11zm-3 0h-5.5l5.5-11z" fill="currentColor" />
    </SettingIconSvg>
  );
}

/** Flip vertical — Penpot `flip-vertical.svg` (filled chevrons). */
export function FlipVerticalIcon({ className }: { className?: string }) {
  return (
    <SettingIconSvg className={className}>
      <path d="m3 9.5v5.5l11-5.5zm0-3v-5.5l11 5.5z" fill="currentColor" />
    </SettingIconSvg>
  );
}

/** Opacity field — Figma-style checkerboard triangle + diagonal. */
export function OpacityIcon({ className }: { className?: string }) {
  const clipId = useId().replace(/:/g, "");
  return (
    <SettingIconSvg className={className}>
      <defs>
        <clipPath id={clipId}>
          <path d="M3.5 12.5 L3.5 3.5 L12.5 3.5 Z" />
        </clipPath>
      </defs>
      <rect
        x="3"
        y="3"
        width="10"
        height="10"
        rx="1.5"
        stroke="currentColor"
        strokeWidth={PENPOT_STROKE}
      />
      <g clipPath={`url(#${clipId})`}>
        <rect x="3.5" y="3.5" width="4.5" height="4.5" fill="currentColor" opacity="0.5" />
        <rect x="8" y="3.5" width="4.5" height="4.5" fill="currentColor" opacity="0.2" />
        <rect x="3.5" y="8" width="4.5" height="4.5" fill="currentColor" opacity="0.2" />
        <rect x="8" y="8" width="4.5" height="4.5" fill="currentColor" opacity="0.5" />
      </g>
      <path
        d="M3.75 12.25 L12.25 3.75"
        stroke="currentColor"
        strokeWidth={PENPOT_STROKE}
        strokeLinecap="round"
      />
    </SettingIconSvg>
  );
}

/** Independent corner-radius toggle — Penpot `corner-radius.svg`. */
export function CornerRadiusIcon({ className }: { className?: string }) {
  return (
    <SettingIconSvg className={className}>
      <path
        d="m6 14h-1c-1.657 0-3-1.343-3-3v-1m8 4h1c1.657 0 3-1.343 3-3v-1m-4-8h1c1.657 0 3 1.343 3 3v1m-8-4h-1c-1.657 0-3 1.343-3 3v1"
        stroke="currentColor"
        strokeWidth={PENPOT_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </SettingIconSvg>
  );
}

/** Single corner arc — Penpot `corner-top-left.svg` et al. (0 TL, 1 TR, 2 BR, 3 BL). */
export function SingleCornerIcon({
  corner,
  className,
}: {
  corner: number;
  className?: string;
}) {
  const paths: Record<number, string> = {
    0: "M14 2H9.5A7.499 7.499 0 002 9.5V14",
    1: "M2 2h4.5A7.499 7.499 0 0114 9.5V14",
    2: "M2 14h4.5A7.5 7.5 0 0014 6.5V2",
    3: "M14 14H9.5A7.5 7.5 0 012 6.5V2",
  };
  return (
    <SettingIconSvg className={className}>
      <path
        d={paths[corner] ?? paths[0]}
        stroke="currentColor"
        strokeWidth={PENPOT_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </SettingIconSvg>
  );
}

/** Shadow X offset — Lucide `move-horizontal`. */
export function EffectOffsetXIcon({ className }: { className?: string }) {
  return (
    <SettingIconSvg className={className} viewBox="0 0 24 24">
      <path
        d="m18 8l4 4l-4 4M2 12h20M6 8l-4 4l4 4"
        stroke="currentColor"
        strokeWidth={LUCIDE_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </SettingIconSvg>
  );
}

/** Shadow Y offset — Lucide `move-vertical`. */
export function EffectOffsetYIcon({ className }: { className?: string }) {
  return (
    <SettingIconSvg className={className} viewBox="0 0 24 24">
      <path
        d="M12 2v20m-4-4l4 4l4-4M8 6l4-4l4 4"
        stroke="currentColor"
        strokeWidth={LUCIDE_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </SettingIconSvg>
  );
}

/** Shadow blur — Figma-style solid core + soft rings. */
export function EffectBlurIcon({ className }: { className?: string }) {
  return (
    <SettingIconSvg className={className}>
      <circle cx="8" cy="8" r="1.1" fill="currentColor" />
      <circle cx="8" cy="8" r="2.75" stroke="currentColor" strokeWidth={PENPOT_STROKE} opacity={0.7} />
      <circle cx="8" cy="8" r="4.4" stroke="currentColor" strokeWidth={PENPOT_STROKE} opacity={0.35} />
    </SettingIconSvg>
  );
}

/** Shadow spread — outward ticks from inset rounded rect (Figma effect field). */
export function EffectSpreadIcon({ className }: { className?: string }) {
  return (
    <SettingIconSvg className={className}>
      <rect
        x="5.25"
        y="5.25"
        width="5.5"
        height="5.5"
        rx="1"
        stroke="currentColor"
        strokeWidth={PENPOT_STROKE}
      />
      <path
        d="M8 2.75v1.75M8 11.5v-1.75M2.75 8h1.75M11.5 8h-1.75"
        stroke="currentColor"
        strokeWidth={PENPOT_STROKE}
        strokeLinecap="round"
      />
    </SettingIconSvg>
  );
}

/** Auto layout horizontal — Penpot `flex-horizontal.svg` (stacked row bars). */
export function AutoLayoutHorizontalIcon({ className }: { className?: string }) {
  return (
    <SettingIconSvg className={className}>
      <path
        d="M14 2.89v2.22a.89.89 0 0 1-.89.89H2.89A.89.89 0 0 1 2 5.11V2.89c0-.493.397-.89.89-.89h10.22c.493 0 .89.397.89.89Zm0 8v2.22a.89.89 0 0 1-.89.89H2.89a.89.89 0 0 1-.89-.89v-2.22c0-.492.397-.89.89-.89h10.22c.493 0 .89.398.89.89Z"
        fill="currentColor"
      />
    </SettingIconSvg>
  );
}

/** Auto layout vertical — Penpot `flex-vertical.svg` (stacked column bars). */
export function AutoLayoutVerticalIcon({ className }: { className?: string }) {
  return (
    <SettingIconSvg className={className}>
      <path
        d="M13.11 14h-2.22a.89.89 0 0 1-.89-.89V2.89a.89.89 0 0 1 .89-.89h2.22c.492 0 .89.397.89.89v10.22c0 .493-.398.89-.89.89Zm-8 0H2.89a.89.89 0 0 1-.89-.89V2.89A.89.89 0 0 1 2.89 2h2.22c.493 0 .89.397.89.89v10.22c0 .493-.397.89-.89.89Z"
        fill="currentColor"
      />
    </SettingIconSvg>
  );
}

/** Padding top — Penpot `padding-top.svg`. */
export function PaddingTopIcon({ className }: { className?: string }) {
  return (
    <SettingIconSvg className={className}>
      <path
        d="m11.667 15.333h-7.334c-.552 0-1-.447-1-1v-7.333c0-.552.448-1 1-1h7.334c.552 0 1 .448 1 1v7.333c0 .553-.448 1-1 1zm.333-13.333h-8c-.368 0-.667-.298-.667-.667 0-.368.299-.666.667-.666h8c.368 0 .667.298.667.666 0 .369-.299.667-.667.667z"
        fill="currentColor"
      />
    </SettingIconSvg>
  );
}

/** Padding right — Penpot `padding-right.svg`. */
export function PaddingRightIcon({ className }: { className?: string }) {
  return (
    <SettingIconSvg className={className}>
      <path
        d="m.667 11.667v-7.334c0-.552.447-1 1-1h7.333c.552 0 1 .448 1 1v7.334c0 .552-.448 1-1 1h-7.333c-.553 0-1-.448-1-1zm13.333.333v-8c0-.368.299-.667.667-.667s.666.299.666.667v8c0 .368-.298.667-.666.667s-.667-.299-.667-.667z"
        fill="currentColor"
      />
    </SettingIconSvg>
  );
}

/** Padding bottom — Penpot `padding-bottom.svg`. */
export function PaddingBottomIcon({ className }: { className?: string }) {
  return (
    <SettingIconSvg className={className}>
      <path
        d="m11.667.667h-7.334c-.552 0-1 .447-1 1v7.333c0 .552.448 1 1 1h7.334c.552 0 1-.448 1-1v-7.333c0-.553-.448-1-1-1zm.333 13.333h-8c-.368 0-.667.299-.667.667s.299.666.667.666h8c.368 0 .667-.298.667-.666s-.299-.667-.667-.667z"
        fill="currentColor"
      />
    </SettingIconSvg>
  );
}

/** Padding left — Penpot `padding-left.svg`. */
export function PaddingLeftIcon({ className }: { className?: string }) {
  return (
    <SettingIconSvg className={className}>
      <path
        d="m15.333 11.667v-7.334c0-.552-.447-1-1-1h-7.333c-.552 0-1 .448-1 1v7.334c0 .552.448 1 1 1h7.333c.553 0 1-.448 1-1zm-13.333.333v-8c0-.368-.298-.667-.667-.667-.368 0-.666.299-.666.667v8c0 .368.298.667.666.667.369 0 .667-.299.667-.667z"
        fill="currentColor"
      />
    </SettingIconSvg>
  );
}

/** Layout direction row — Penpot `row.svg`. */
export function LayoutDirectionRowIcon({ className }: { className?: string }) {
  return (
    <SettingIconSvg className={className}>
      <path
        d="m8.179 4 4 4m0 0-4 4m4-4H2.846"
        stroke="currentColor"
        strokeWidth={PENPOT_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </SettingIconSvg>
  );
}

/** Layout direction column — Penpot `column.svg`. */
export function LayoutDirectionColumnIcon({ className }: { className?: string }) {
  return (
    <SettingIconSvg className={className}>
      <path
        d="M12.488 8.667l-4 4m0 0l-4-4m4 4V3.333"
        stroke="currentColor"
        strokeWidth={PENPOT_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </SettingIconSvg>
  );
}

/** Gap horizontal — Penpot `gap-horizontal.svg`. */
export function GapHorizontalIcon({ className }: { className?: string }) {
  return (
    <SettingIconSvg className={className}>
      <path
        d="m.667 2h.666c.553 0 1 .448 1 1v10c0 .552-.447 1-1 1h-.666m14.666-12h-.666c-.553 0-1 .448-1 1v10c0 .552.447 1 1 1h.666m-8-8.667v5.334c0 .368.299.666.667.666s.667-.298.667-.666v-5.334c0-.368-.299-.666-.667-.666s-.667.298-.667.666z"
        fill="currentColor"
      />
    </SettingIconSvg>
  );
}

/** Gap vertical — Penpot `gap-vertical.svg`. */
export function GapVerticalIcon({ className }: { className?: string }) {
  return (
    <SettingIconSvg className={className}>
      <path
        d="m14 .667v.666c0 .553-.448 1-1 1h-10c-.552 0-1-.447-1-1v-.666m12 14.666v-.666c0-.553-.448-1-1-1h-10c-.552 0-1 .447-1 1v.666m8.667-8h-5.334c-.368 0-.666.299-.666.667s.298.667.666.667h5.334c.368 0 .666-.299.666-.667s-.298-.667-.666-.667z"
        fill="currentColor"
      />
    </SettingIconSvg>
  );
}

/** Linked horizontal padding — Penpot `padding-left-right.svg`. */
export function PaddingHorizontalIcon({ className }: { className?: string }) {
  return (
    <SettingIconSvg className={className}>
      <path
        d="m10.667 11.667v-7.334c0-.552-.448-1-1-1h-3.334c-.552 0-1 .448-1 1v7.334c0 .552.448 1 1 1h3.334c.552 0 1-.448 1-1zm-8.667-1v-5.334c0-.368-.298-.666-.667-.666-.368 0-.666.298-.666.666v5.334c0 .368.298.666.666.666.369 0 .667-.298.667-.666zm13.333 0v-5.334c0-.368-.298-.666-.666-.666-.369 0-.667.298-.667.666v5.334c0 .368.298.666.667.666.368 0 .666-.298.666-.666z"
        fill="currentColor"
      />
    </SettingIconSvg>
  );
}

/** Linked vertical padding — Penpot `padding-top-bottom.svg`. */
export function PaddingVerticalIcon({ className }: { className?: string }) {
  return (
    <SettingIconSvg className={className}>
      <path
        d="m4.333 10.667h7.334c.552 0 1-.448 1-1v-3.334c0-.552-.448-1-1-1h-7.334c-.552 0-1 .448-1 1v3.334c0 .552.448 1 1 1zm1-8.667h5.334c.368 0 .666-.298.666-.667 0-.368-.298-.666-.666-.666h-5.334c-.368 0-.666.298-.666.666 0 .369.298.667.666.667zm0 13.333h5.334c.368 0 .666-.298.666-.666s-.298-.667-.666-.667h-5.334c-.368 0-.666.299-.666.667s.298.666.666.666z"
        fill="currentColor"
      />
    </SettingIconSvg>
  );
}

/** Text auto width — Penpot `text-auto-width.svg` (Figma WIDTH_AND_HEIGHT). */
export function TextAutoWidthIcon({ className }: { className?: string }) {
  return (
    <SettingIconSvg className={className}>
      <path
        d="M5.334 8l.863-1.918m0 0l1.537-3.415L9.27 6.082m-3.074 0H9.27m0 0L10.133 8m3.533 4.666h-12m12 0v-1.333m0 1.333V14m-12-1.334v-1.333m0 1.333V14"
        stroke="currentColor"
        strokeWidth={PENPOT_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </SettingIconSvg>
  );
}

/** Text auto height — Penpot `text-auto-height.svg` (Figma HEIGHT / wrap). */
export function TextAutoHeightIcon({ className }: { className?: string }) {
  return (
    <SettingIconSvg className={className}>
      <path
        d="M13.334 12H6m9.334-8H6m4.667 4H6m-4 6V2m0 12h1.334M2 14H.667M2 2h1.334M2 2H.667"
        stroke="currentColor"
        strokeWidth={PENPOT_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </SettingIconSvg>
  );
}

/** Text fixed size — Penpot `text-fixed.svg` (Figma NONE). */
export function TextFixedSizeIcon({ className }: { className?: string }) {
  return (
    <SettingIconSvg className={className}>
      <path
        d="M5.667 10.667l.863-1.918m0 0l1.537-3.416 1.536 3.416m-3.073 0h3.073m0 0l.864 1.918M1.333 3.333c0-1.103.897-2 2-2h9.334c1.103 0 2 .897 2 2v9.334c0 1.103-.897 2-2 2H3.333c-1.103 0-2-.897-2-2V3.333z"
        stroke="currentColor"
        strokeWidth={PENPOT_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </SettingIconSvg>
  );
}

/** Text align left — Penpot `text-align-left.svg`. */
export function TextAlignLeftIcon({ className }: { className?: string }) {
  return (
    <SettingIconSvg className={className}>
      <path
        d="m7.333 8h-5.333m12-4h-12m9.333 8h-9.333"
        stroke="currentColor"
        strokeWidth={PENPOT_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </SettingIconSvg>
  );
}

/** Text align center — Penpot `text-align-center.svg`. */
export function TextAlignCenterIcon({ className }: { className?: string }) {
  return (
    <SettingIconSvg className={className}>
      <path
        d="m5.333 8h5.334m-8.667-4h12m-10 8h8"
        stroke="currentColor"
        strokeWidth={PENPOT_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </SettingIconSvg>
  );
}

/** Text align right — Penpot `text-align-right.svg`. */
export function TextAlignRightIcon({ className }: { className?: string }) {
  return (
    <SettingIconSvg className={className}>
      <path
        d="m14 8h-5.333m5.333-4h-12m12 8h-9.333"
        stroke="currentColor"
        strokeWidth={PENPOT_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </SettingIconSvg>
  );
}

/** Text align justify — Penpot `text-justify.svg`. */
export function TextAlignJustifyIcon({ className }: { className?: string }) {
  return (
    <SettingIconSvg className={className}>
      <path
        d="M14 8H2m12-4H2m12 8H2"
        stroke="currentColor"
        strokeWidth={PENPOT_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </SettingIconSvg>
  );
}

/** Text line height — Figma `A` with lines above/below. */
export function TextLineHeightIcon({ className }: { className?: string }) {
  return (
    <SettingIconSvg className={className}>
      <path
        d="M3.5 4.5h9M3.5 11.5h9"
        stroke="currentColor"
        strokeWidth={PENPOT_STROKE}
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M8 6.5v3"
        stroke="currentColor"
        strokeWidth={PENPOT_STROKE}
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M6.5 8h3"
        stroke="currentColor"
        strokeWidth={PENPOT_STROKE}
        strokeLinecap="round"
        fill="none"
      />
    </SettingIconSvg>
  );
}

/** Text letter spacing — Figma `|A|` tracking icon. */
export function TextLetterSpacingIcon({ className }: { className?: string }) {
  return (
    <SettingIconSvg className={className}>
      <path
        d="M3 5.5v5M13 5.5v5"
        stroke="currentColor"
        strokeWidth={PENPOT_STROKE}
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M8 6.25v3.5"
        stroke="currentColor"
        strokeWidth={PENPOT_STROKE}
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M6.5 8h3"
        stroke="currentColor"
        strokeWidth={PENPOT_STROKE}
        strokeLinecap="round"
        fill="none"
      />
    </SettingIconSvg>
  );
}

/** Text vertical align top — Penpot `text-top.svg`. */
export function TextVerticalAlignTopIcon({ className }: { className?: string }) {
  return (
    <SettingIconSvg className={className}>
      <path
        d="M6 13l2-2 2 2M3.333 3h9.334M3.333 5.667h9.334"
        stroke="currentColor"
        strokeWidth={PENPOT_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </SettingIconSvg>
  );
}

/** Text vertical align middle — Penpot `text-middle.svg`. */
export function TextVerticalAlignMiddleIcon({ className }: { className?: string }) {
  return (
    <SettingIconSvg className={className}>
      <path
        d="M6 14l2-2 2 2M3.333 6.667h9.334M3.333 9.333h9.334M10 2L8 4 6 2"
        stroke="currentColor"
        strokeWidth={PENPOT_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </SettingIconSvg>
  );
}

/** Text vertical align bottom — Penpot `text-bottom.svg`. */
export function TextVerticalAlignBottomIcon({ className }: { className?: string }) {
  return (
    <SettingIconSvg className={className}>
      <path
        d="M10 3L8 5 6 3m6.667 10H3.333m9.334-2.667H3.333"
        stroke="currentColor"
        strokeWidth={PENPOT_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </SettingIconSvg>
  );
}

/** Layer align left — Penpot `align-left.svg`. */
export function LayerAlignLeftIcon({ className }: { className?: string }) {
  return (
    <SettingIconSvg className={className}>
      <path
        d="m1.333 1.333v13.334m3.334-7.334c0-1.103.896-2 2-2h6.666c1.104 0 2 .897 2 2v1.334c0 1.104-.896 2-2 2h-6.666c-1.104 0-2-.896-2-2z"
        stroke="currentColor"
        strokeWidth={PENPOT_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </SettingIconSvg>
  );
}

/** Layer align right — Penpot `align-right.svg`. */
export function LayerAlignRightIcon({ className }: { className?: string }) {
  return (
    <SettingIconSvg className={className}>
      <path
        d="m14.667 1.333v13.334m-14-7.334c0-1.103.896-2 2-2h6.666c1.104 0 2 .897 2 2v1.334c0 1.104-.896 2-2 2h-6.666c-1.104 0-2-.896-2-2z"
        stroke="currentColor"
        strokeWidth={PENPOT_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </SettingIconSvg>
  );
}

/** Layer align top — Penpot `align-top.svg`. */
export function LayerAlignTopIcon({ className }: { className?: string }) {
  return (
    <SettingIconSvg className={className}>
      <path
        d="m14.667 1.333h-13.334m7.334 3.334c1.104 0 2 .896 2 2v6.666c0 1.104-.896 2-2 2h-1.334c-1.103 0-2-.896-2-2v-6.666c0-1.104.897-2 2-2z"
        stroke="currentColor"
        strokeWidth={PENPOT_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </SettingIconSvg>
  );
}

/** Layer align bottom — Penpot `align-bottom.svg`. */
export function LayerAlignBottomIcon({ className }: { className?: string }) {
  return (
    <SettingIconSvg className={className}>
      <path
        d="m14.667 14.667h-13.334m7.334-14c1.104 0 2 .896 2 2v6.666c0 1.104-.896 2-2 2h-1.334c-1.103 0-2-.896-2-2v-6.666c0-1.104.897-2 2-2z"
        stroke="currentColor"
        strokeWidth={PENPOT_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </SettingIconSvg>
  );
}

/** Layer align horizontal centers — Penpot `align-horizontal-center.svg`. */
export function LayerAlignHorizontalCenterIcon({ className }: { className?: string }) {
  return (
    <SettingIconSvg className={className}>
      <path
        d="m8 .667v4.666m0 5.334v4.666m-5.333-8c0-1.103.896-2 2-2h3.333 3.333c1.104 0 2 .897 2 2v1.334c0 1.104-.896 2-2 2h-3.333-3.333c-1.104 0-2-.896-2-2z"
        stroke="currentColor"
        strokeWidth={PENPOT_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </SettingIconSvg>
  );
}

/** Layer align vertical centers — Penpot `align-vertical-center.svg`. */
export function LayerAlignVerticalCenterIcon({ className }: { className?: string }) {
  return (
    <SettingIconSvg className={className}>
      <path
        d="m5.333 8h-4.666m14.666 0h-4.666m-2-5.333c1.104 0 2 .896 2 2v3.333 3.333c0 1.104-.896 2-2 2h-1.334c-1.103 0-2-.896-2-2v-3.333-3.333c0-1.104.897-2 2-2z"
        stroke="currentColor"
        strokeWidth={PENPOT_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </SettingIconSvg>
  );
}

/** Selection align top-left — Penpot `align-items-column-start.svg`. */
export function SelectionAlignTopLeftIcon({ className }: { className?: string }) {
  return (
    <SettingIconSvg className={className}>
      <path
        d="M2 14.7V1.4m12 2.8c0-.8-.7-1.5-1.5-1.5H6.2c-.8 0-1.5.7-1.5 1.5v1c0 .8.7 1.5 1.5 1.5h6.3c.8 0 1.5-.7 1.5-1.5v-1zm-2.7 6.6c0-.8-.7-1.5-1.5-1.5H6.2c-.8 0-1.5.7-1.5 1.5v1c0 .8.7 1.5 1.5 1.5h3.7c.8 0 1.5-.7 1.5-1.5v-1h-.1z"
        stroke="currentColor"
        strokeWidth={PENPOT_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </SettingIconSvg>
  );
}

/** Selection align top-right — Penpot `align-items-column-end.svg`. */
export function SelectionAlignTopRightIcon({ className }: { className?: string }) {
  return (
    <SettingIconSvg className={className}>
      <path
        d="M14 14.667V1.333M2 4.166c0-.827.672-1.5 1.5-1.5h6.333c.828 0 1.5.673 1.5 1.5v1a1.5 1.5 0 01-1.5 1.5H3.5a1.5 1.5 0 01-1.5-1.5v-1zm2.667 6.667a1.5 1.5 0 011.5-1.5h3.666a1.5 1.5 0 011.5 1.5v1a1.5 1.5 0 01-1.5 1.5H6.167a1.5 1.5 0 01-1.5-1.5v-1z"
        stroke="currentColor"
        strokeWidth={PENPOT_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </SettingIconSvg>
  );
}

/** Selection align bottom-left — Penpot `align-items-row-start.svg`. */
export function SelectionAlignBottomLeftIcon({ className }: { className?: string }) {
  return (
    <SettingIconSvg className={className}>
      <path
        d="m11.8 14c.8 0 1.5-.7 1.5-1.5v-6.3c0-.8-.7-1.5-1.5-1.5h-1c-.8 0-1.5.7-1.5 1.5v6.3c0 .8.7 1.5 1.5 1.5zm-6.6-2.7c.8 0 1.5-.7 1.5-1.5v-3.6c0-.8-.7-1.5-1.5-1.5h-1c-.8 0-1.5.7-1.5 1.5v3.7c0 .8.7 1.5 1.5 1.5h1zm-3.9-9.3h13.3"
        stroke="currentColor"
        strokeWidth={PENPOT_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </SettingIconSvg>
  );
}

/** Selection align bottom-right — Penpot `align-items-row-end.svg`. */
export function SelectionAlignBottomRightIcon({ className }: { className?: string }) {
  return (
    <SettingIconSvg className={className}>
      <path
        d="m11.834 2c.827 0 1.5.672 1.5 1.5v6.333c0 .828-.673 1.5-1.5 1.5h-1c-.828 0-1.5-.672-1.5-1.5v-6.333c0-.828.672-1.5 1.5-1.5zm-6.667 2.667c.828 0 1.5.672 1.5 1.5v3.666c0 .828-.672 1.5-1.5 1.5h-1c-.828 0-1.5-.672-1.5-1.5v-3.666c0-.828.672-1.5 1.5-1.5zm-3.834 9.333h13.334"
        stroke="currentColor"
        strokeWidth={PENPOT_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </SettingIconSvg>
  );
}

/** Distribute horizontal spacing — Penpot `distribute-horizontally.svg`. */
export function DistributeHorizontallyIcon({ className }: { className?: string }) {
  return (
    <SettingIconSvg className={className}>
      <path
        d="M2.667 1.333v13.334zm10.666 0v13.334zm-5 2c1.104 0 2 .897 2 2v5.334a2 2 0 01-2 2h-.666a2 2 0 01-2-2V5.333c0-1.103.896-2 2-2h.666z"
        stroke="currentColor"
        strokeWidth={PENPOT_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </SettingIconSvg>
  );
}

/** Distribute vertical spacing — Penpot `distribute-vertical-spacing.svg`. */
export function DistributeVerticalSpacingIcon({ className }: { className?: string }) {
  return (
    <SettingIconSvg className={className}>
      <path
        d="m1.333 2.667h13.334m-13.334 10.666h13.334m-11.334-5.666c0-1.104.896-2 2-2h5.334c1.103 0 2 .896 2 2v.666c0 1.104-.897 2-2 2h-5.334c-1.104 0-2-.896-2-2z"
        stroke="currentColor"
        strokeWidth={PENPOT_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </SettingIconSvg>
  );
}

/** Individual padding sides — Penpot `padding-extended.svg`. */
export function PaddingExtendedIcon({ className }: { className?: string }) {
  return (
    <SettingIconSvg className={className}>
      <path
        d="m4 5v6c0 .552.448 1 1 1h6c.552 0 1-.448 1-1v-6c0-.552-.448-1-1-1h-6c-.552 0-1 .448-1 1zm10.667.667v4.666c0 .184.149.334.333.334s.333-.15.333-.334v-4.666c0-.184-.149-.334-.333-.334s-.333.15-.333.334zm-14 0v4.666c0 .184.149.334.333.334s.333-.15.333-.334v-4.666c0-.184-.149-.334-.333-.334s-.333.15-.333.334zm9.666 9h-4.666c-.184 0-.334.149-.334.333s.15.333.334.333h4.666c.185 0 .334-.149.334-.333s-.149-.333-.334-.333zm0-14h-4.666c-.184 0-.334.149-.334.333s.15.333.334.333h4.666c.185 0 .334-.149.334-.333s-.149-.333-.334-.333z"
        fill="currentColor"
      />
    </SettingIconSvg>
  );
}
