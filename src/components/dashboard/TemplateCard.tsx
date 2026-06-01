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
        "flex flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm",
        "transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md",
      )}
    >
      <button type="button" className="relative aspect-[5/3] w-full text-left" style={{ background: accent }} onClick={onUse}>
        <span className="absolute inset-0 flex items-center justify-center bg-black/[0.08]">
          <Sparkles className="h-9 w-9 text-white drop-shadow" strokeWidth={1.5} />
        </span>
      </button>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="text-[13px] font-semibold text-slate-900">{title}</h3>
        <p className="line-clamp-2 text-[12px] leading-snug text-slate-600">{description}</p>
        <button
          type="button"
          onClick={onUse}
          className="mt-2 inline-flex w-fit items-center rounded-lg bg-slate-900 px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-slate-800"
        >
          Use template
        </button>
      </div>
    </div>
  );
}
