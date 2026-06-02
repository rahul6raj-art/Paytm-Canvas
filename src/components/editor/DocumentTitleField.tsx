"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/useEditorStore";

export function DocumentTitleField() {
  const fileName = useEditorStore((s) => s.fileName);
  const documentHydrating = useEditorStore((s) => s.documentHydrating);
  const setDocumentName = useEditorStore((s) => s.setDocumentName);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(fileName);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(fileName);
  }, [fileName, editing]);

  useEffect(() => {
    if (!editing) return;
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, [editing]);

  const commit = () => {
    setDocumentName(draft);
    setEditing(false);
  };

  const cancel = () => {
    setDraft(fileName);
    setEditing(false);
  };

  const displayName = mounted && !documentHydrating ? fileName : "Untitled";

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={draft}
        aria-label="Page title"
        className="min-w-0 flex-1 rounded border border-[rgba(13,153,255,0.45)] bg-app-field px-1.5 py-0.5 text-ui-sm font-medium leading-tight text-app-fg outline-none ring-1 ring-[rgba(13,153,255,0.25)]"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          }
        }}
      />
    );
  }

  return (
    <button
      type="button"
      title="Click to rename page"
      aria-label={`Page title: ${displayName}. Click to rename.`}
      onClick={() => {
        setDraft(fileName);
        setEditing(true);
      }}
      className={cn(
        "min-w-0 flex-1 truncate rounded px-1 py-0.5 text-left text-ui-sm font-medium leading-tight text-app-fg",
        "transition-colors hover:bg-app-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent",
      )}
    >
      {displayName}
    </button>
  );
}
