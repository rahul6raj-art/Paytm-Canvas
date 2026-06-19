"use client";

import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TemplateCardProps {
  title: string;
  description: string;
  accent: string;
  onUse: () => void;
}

export function TemplateCard({ title, description, accent, onUse }: TemplateCardProps) {
  return (
    <div
      className={cn(
        "editor-sidebar-section flex flex-col overflow-hidden shadow-none transition-colors",
        "hover:border-app-border",
      )}
    >
      <button
        type="button"
        className="relative aspect-[5/3] w-full border-b border-app-border-subtle text-left"
        style={{ background: accent }}
        onClick={onUse}
      >
        <span className="absolute inset-0 flex items-center justify-center bg-black/[0.08] dark:bg-black/20">
          <Sparkles className="h-9 w-9 text-white/90 drop-shadow" strokeWidth={1.5} />
        </span>
      </button>
      <div className="flex flex-1 flex-col gap-1 p-3.5">
        <h3 className="text-ui font-semibold text-app-fg">{title}</h3>
        <p className="line-clamp-2 text-ui leading-snug text-app-muted">{description}</p>
        <button
          type="button"
          onClick={onUse}
          className="mt-2 inline-flex w-fit items-center rounded-lg border border-app-border-subtle bg-app-inset px-3 py-1.5 text-ui font-medium text-app-fg transition-colors hover:border-app-border hover:bg-app-hover"
        >
          Use template
        </button>
      </div>
    </div>
  );
}
