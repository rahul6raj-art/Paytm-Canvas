import Image from "next/image";

const FIGMA_LOGO_SRC = "/brand/figma-logo-3d.png";

/** 3D Figma logomark for import UI. */
export function FigmaLogoMark({ className }: { className?: string }) {
  return (
    <Image
      src={FIGMA_LOGO_SRC}
      alt=""
      width={112}
      height={112}
      className={className}
      aria-hidden
      priority
    />
  );
}
