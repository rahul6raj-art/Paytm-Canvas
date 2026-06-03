"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

function TransformIconBtn({
  active,
  disabled,
  title,
  onClick,
  children,
  className,
}: {
  active?: boolean;
  disabled?: boolean;
  title: string;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-6 min-w-0 flex-1 items-center justify-center text-app-muted transition-colors",
        "hover:bg-app-hover hover:text-app-fg disabled:opacity-40",
        active && "bg-accent/15 text-app-fg",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Rotate90Icon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className="text-current">
      <path
        d="M8 3.2 11.2 6.4 8 9.6 4.8 6.4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinejoin="round"
      />
      <path
        d="M5.2 2.6a5.2 5.2 0 0 1 6.1-.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinecap="round"
      />
      <path
        d="M10.8 2.2 11.6 4.1 9.7 4.9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FlipHorizontalIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className="text-current">
      <line x1="8" y1="2.5" x2="8" y2="13.5" stroke="currentColor" strokeWidth="1.15" />
      <path
        d="M4.5 6 6.8 8 4.5 10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11.5 6 9.2 8 11.5 10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FlipVerticalIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className="text-current">
      <line x1="2.5" y1="8" x2="13.5" y2="8" stroke="currentColor" strokeWidth="1.15" />
      <path
        d="M6 4.5 8 6.8 10 4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 11.5 8 9.2 10 11.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TransformActions({
  flipHorizontal,
  flipVertical,
  disabled,
  onRotate90,
  onFlipHorizontal,
  onFlipVertical,
}: {
  flipHorizontal?: boolean;
  flipVertical?: boolean;
  disabled?: boolean;
  onRotate90: () => void;
  onFlipHorizontal: () => void;
  onFlipVertical: () => void;
}) {
  return (
    <div
      className="flex overflow-hidden rounded-md border border-app-border bg-app-inset"
      role="group"
      aria-label="Transform"
    >
      <TransformIconBtn
        disabled={disabled}
        title="Rotate 90°"
        onClick={onRotate90}
        className="border-r border-app-border"
      >
        <Rotate90Icon />
      </TransformIconBtn>
      <TransformIconBtn
        active={flipHorizontal}
        disabled={disabled}
        title="Flip horizontal"
        onClick={onFlipHorizontal}
        className="border-r border-app-border"
      >
        <FlipHorizontalIcon />
      </TransformIconBtn>
      <TransformIconBtn
        active={flipVertical}
        disabled={disabled}
        title="Flip vertical"
        onClick={onFlipVertical}
      >
        <FlipVerticalIcon />
      </TransformIconBtn>
    </div>
  );
}
