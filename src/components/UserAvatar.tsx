"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export type UserAvatarProps = {
  name: string;
  initials: string;
  avatarUrl?: string | null;
  avatarHue?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
  imageClassName?: string;
};

const sizeClasses = {
  sm: "h-7 w-7 text-ui",
  md: "h-9 w-9 text-ui",
  lg: "h-11 w-11 text-ui-lg",
} as const;

export function UserAvatar({
  name,
  initials,
  avatarUrl,
  avatarHue = 210,
  size = "md",
  className,
  imageClassName,
}: UserAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(avatarUrl) && !imageFailed;

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-app-border-subtle bg-app-panel font-bold text-app-fg",
        sizeClasses[size],
        !showImage && "bg-app-inset",
        className,
      )}
      style={
        showImage
          ? undefined
          : { boxShadow: `inset 0 0 0 2px hsl(${avatarHue} 70% 45% / 0.2)` }
      }
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl!}
          alt={`${name} profile photo`}
          className={cn("h-full w-full object-cover", imageClassName)}
          onError={() => setImageFailed(true)}
        />
      ) : (
        initials
      )}
    </span>
  );
}
