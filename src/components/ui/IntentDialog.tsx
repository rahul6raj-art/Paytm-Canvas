"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type IntentDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
};

/** Two-action confirmation dialog for destructive or high-intent actions. */
export function IntentDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  destructive = false,
}: IntentDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[230] flex items-center justify-center bg-black/55 px-4 backdrop-blur-[2px]"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="intent-dialog-title"
      aria-describedby="intent-dialog-desc"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-app-border bg-app-panel shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="border-b border-app-border-subtle px-5 pb-4 pt-5">
          <h2 id="intent-dialog-title" className="text-lg font-semibold text-app-fg">
            {title}
          </h2>
          <p id="intent-dialog-desc" className="mt-2 text-ui text-app-muted">
            {description}
          </p>
        </header>
        <footer className="flex justify-end gap-2 border-t border-app-border-subtle px-5 py-3">
          <Button type="button" variant="toolbar" onClick={onCancel} className="h-9">
            {cancelLabel}
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            className={cn(
              "h-9",
              destructive
                ? "bg-red-600 text-white hover:bg-red-500"
                : "bg-app-fg text-app-bg hover:brightness-95",
            )}
          >
            {confirmLabel}
          </Button>
        </footer>
      </div>
    </div>
  );
}
