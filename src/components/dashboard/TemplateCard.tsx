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
        "flex flex-col overflow-hidden rounded-xl border border-app-border/90 bg-app-card shadow-sm",
        "transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md",
      )}
    >
      <button type="button" className="relative aspect-[5/3] w-full text-left" style={{ background: accent }} onClick={onUse}>
        <span className="absolute inset-0 flex items-center justify-center bg-black/[0.08]">
          <Sparkles className="h-9 w-9 text-app-bg drop-shadow" strokeWidth={1.5} />
        </span>
      </button>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="text-[13px] font-semibold text-app-fg">{title}</h3>
        <p className="line-clamp-2 text-[12px] leading-snug text-app-muted">{description}</p>
        <button
          type="button"
          onClick={onUse}
          className="mt-2 inline-flex w-fit items-center rounded-lg bg-app-fg px-3 py-1.5 text-[12px] font-medium text-app-bg transition-colors hover:bg-app-muted"
        >
          Use template
        </button>
      </div>
    </div>
  );
}
