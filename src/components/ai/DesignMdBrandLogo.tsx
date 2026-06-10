"use client";

import { FileCode } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  logo?: string;
  label: string;
  className?: string;
  boxClassName?: string;
};

export function DesignMdBrandLogo({ logo, label, className, boxClassName }: Props) {
  const [failed, setFailed] = useState(false);
  const initials = label
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  if (!logo || failed) {
    return (
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-app-border bg-app-inset text-[10px] font-semibold text-app-muted",
          boxClassName,
        )}
      >
        {logo && failed ? initials : <FileCode className="h-4 w-4 shrink-0 text-app-muted" strokeWidth={1.75} />}
      </span>
    );
  }

  const isSvg = logo.endsWith(".svg");

  return (
    <span
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-app-border bg-white p-1",
        boxClassName,
      )}
    >
      <img
        src={logo}
        alt=""
        aria-hidden
        className={cn(
          "h-full w-full object-contain",
          isSvg && "dark:invert",
          className,
        )}
        onError={() => setFailed(true)}
      />
    </span>
  );
}
