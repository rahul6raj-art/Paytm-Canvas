import {
  BooleanExcludeIcon,
  BooleanIntersectIcon,
  BooleanMenuIcon,
  BooleanSubtractIcon,
  BooleanUnionIcon,
} from "@/components/editor/design-panel/BooleanOperationIcons";
import {
  AutoLayoutHorizontalIcon,
  AutoLayoutVerticalIcon,
  CornerRadiusIcon,
  EffectBlurIcon,
  EffectOffsetXIcon,
  EffectOffsetYIcon,
  EffectSpreadIcon,
  FlipHorizontalIcon,
  FlipVerticalIcon,
  OpacityIcon,
  PaddingBottomIcon,
  PaddingLeftIcon,
  PaddingRightIcon,
  PaddingTopIcon,
  Rotate90Icon,
  RotationAngleIcon,
  SingleCornerIcon,
} from "@/components/editor/design-panel/InspectorSettingIcons";
import {
  inspectorFieldIconSlotClass,
  inspectorTransformActionBtnClass,
} from "@/lib/inspectorIconStyles";
import { inspectorControlHeightClass } from "@/lib/appFieldStyles";

const SETTING_ICONS = [
  { name: "RotationAngleIcon", node: <RotationAngleIcon /> },
  { name: "Rotate90Icon", node: <Rotate90Icon /> },
  { name: "FlipHorizontalIcon", node: <FlipHorizontalIcon /> },
  { name: "FlipVerticalIcon", node: <FlipVerticalIcon /> },
  { name: "OpacityIcon", node: <OpacityIcon /> },
  { name: "CornerRadiusIcon", node: <CornerRadiusIcon /> },
  { name: "SingleCornerIcon (TL)", node: <SingleCornerIcon corner={0} /> },
  { name: "SingleCornerIcon (TR)", node: <SingleCornerIcon corner={1} /> },
  { name: "SingleCornerIcon (BR)", node: <SingleCornerIcon corner={2} /> },
  { name: "SingleCornerIcon (BL)", node: <SingleCornerIcon corner={3} /> },
  { name: "EffectOffsetXIcon", node: <EffectOffsetXIcon /> },
  { name: "EffectOffsetYIcon", node: <EffectOffsetYIcon /> },
  { name: "EffectBlurIcon", node: <EffectBlurIcon /> },
  { name: "EffectSpreadIcon", node: <EffectSpreadIcon /> },
  { name: "AutoLayoutHorizontalIcon", node: <AutoLayoutHorizontalIcon /> },
  { name: "AutoLayoutVerticalIcon", node: <AutoLayoutVerticalIcon /> },
  { name: "PaddingTopIcon", node: <PaddingTopIcon /> },
  { name: "PaddingRightIcon", node: <PaddingRightIcon /> },
  { name: "PaddingBottomIcon", node: <PaddingBottomIcon /> },
  { name: "PaddingLeftIcon", node: <PaddingLeftIcon /> },
] as const;

const BOOLEAN_ICONS = [
  { name: "BooleanUnionIcon", node: <BooleanUnionIcon /> },
  { name: "BooleanSubtractIcon", node: <BooleanSubtractIcon /> },
  { name: "BooleanIntersectIcon", node: <BooleanIntersectIcon /> },
  { name: "BooleanExcludeIcon", node: <BooleanExcludeIcon /> },
  { name: "BooleanMenuIcon", node: <BooleanMenuIcon /> },
] as const;

export default function InspectorIconsPage() {
  return (
    <div className="min-h-dvh bg-chrome text-app-fg">
      <main className="mx-auto max-w-3xl px-6 py-10" data-right-properties-panel>
        <h1 className="text-lg font-semibold">Inspector icon hub</h1>
        <p className="mt-1 text-ui text-app-subtle">
          Shared SVG glyphs for the right properties panel. Paths trace{" "}
          <a
            href="https://github.com/penpot/penpot/tree/develop/frontend/resources/images/icons"
            className="text-accent hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            Penpot
          </a>{" "}
          (Figma-parity) and{" "}
          <a href="https://lucide.dev" className="text-accent hover:underline" target="_blank" rel="noreferrer">
            Lucide
          </a>
          . Import from{" "}
          <code className="font-mono text-app-fg">InspectorSettingIcons.tsx</code> and{" "}
          <code className="font-mono text-app-fg">BooleanOperationIcons.tsx</code>.
        </p>

        <section className="mt-8">
          <h2 className="mb-3 text-ui font-medium">Setting icons (16×16)</h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {SETTING_ICONS.map(({ name, node }) => (
              <li
                key={name}
                className="flex items-center gap-3 rounded-md border border-app-border bg-chrome-panel px-3 py-2"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center text-app-muted">
                  {node}
                </span>
                <span className="min-w-0 truncate font-mono text-caption text-app-subtle">{name}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="mb-3 text-ui font-medium">In context — field slot &amp; transform strip</h2>
          <div className="flex flex-wrap items-center gap-4">
            <div
              className={`flex items-center overflow-hidden rounded-md border border-app-border bg-app-inset ${inspectorControlHeightClass}`}
            >
              <span className={inspectorFieldIconSlotClass}>
                <RotationAngleIcon />
              </span>
              <span className="px-2 font-mono text-ui tabular-nums">45°</span>
            </div>
            <div
              className={`flex overflow-hidden rounded-md border border-app-border bg-app-inset ${inspectorControlHeightClass}`}
              role="group"
              aria-label="Transform preview"
            >
              <button type="button" className={`${inspectorTransformActionBtnClass} border-r border-app-border`}>
                <Rotate90Icon />
              </button>
              <button type="button" className={`${inspectorTransformActionBtnClass} border-r border-app-border`}>
                <FlipHorizontalIcon />
              </button>
              <button type="button" className={inspectorTransformActionBtnClass}>
                <FlipVerticalIcon />
              </button>
            </div>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="mb-3 text-ui font-medium">Boolean icons (16×16)</h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {BOOLEAN_ICONS.map(({ name, node }) => (
              <li
                key={name}
                className="flex items-center gap-3 rounded-md border border-app-border bg-chrome-panel px-3 py-2"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center text-app-muted">
                  {node}
                </span>
                <span className="min-w-0 truncate font-mono text-caption text-app-subtle">{name}</span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
