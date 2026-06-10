"use client";

import { cn } from "@/lib/utils";

type Props = {
  children: React.ReactNode;
  className?: string;
};

/** Animated violet–blue gradient outline for the AI composer card. */
export function AIModalFrame({ children, className }: Props) {
  return (
    <div className="ai-modal-glow">
      <div
        className={cn(
          "ai-modal-glow-inner relative overflow-hidden text-app-fg shadow-2xl shadow-app-panel",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
