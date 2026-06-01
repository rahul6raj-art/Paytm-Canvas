"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useEditorStore } from "@/stores/useEditorStore";
import { getMockCurrentUser } from "@/lib/mockAuth";
import {
  isFigmaDesignUrl,
  readFigmaAccessToken,
  readFigmaConnectionEmail,
  writeFigmaAccessToken,
  writeFigmaConnectionEmail,
} from "@/lib/figmaImportConnection";
import { importFigmaFromApi } from "@/lib/figmaApi/importFigmaApi";
import { documentToEditorPatch } from "@/lib/documentPersistence";
import { FigmaLogoMark } from "@/components/import/FigmaLogoMark";
import { cn } from "@/lib/utils";

type ImportFigmaModalProps = {
  onImportFigFile: (file: File) => Promise<void>;
};

function modKeyLabel(): string {
  if (typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)) {
    return "⌘";
  }
  return "Ctrl";
}

export function ImportFigmaModal({ onImportFigFile }: ImportFigmaModalProps) {
  const router = useRouter();
  const open = useEditorStore((s) => s.importFigmaModalOpen);
  const closeImportFigmaModal = useEditorStore((s) => s.closeImportFigmaModal);
  const applyGeneratedDesign = useEditorStore((s) => s.applyGeneratedDesign);

  const [link, setLink] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null);
  const [figFile, setFigFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setLink("");
      setFigFile(null);
      setLoading(false);
      setError(null);
      return;
    }
    const stored = readFigmaConnectionEmail();
    const user = getMockCurrentUser();
    setConnectedEmail(stored ?? user.email);
    if (!stored) writeFigmaConnectionEmail(user.email);
    setAccessToken(readFigmaAccessToken() ?? "");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) {
        e.preventDefault();
        closeImportFigmaModal();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, loading, closeImportFigmaModal]);

  const onClose = () => {
    if (loading) return;
    closeImportFigmaModal();
  };

  const onUnlink = () => {
    writeFigmaConnectionEmail(null);
    writeFigmaAccessToken(null);
    setConnectedEmail(null);
    setAccessToken("");
  };

  const onConnect = () => {
    const email = getMockCurrentUser().email;
    writeFigmaConnectionEmail(email);
    setConnectedEmail(email);
    if (accessToken.trim()) writeFigmaAccessToken(accessToken);
  };

  const runImport = useCallback(async () => {
    setError(null);
    if (!connectedEmail) {
      setError("Connect your Figma account to continue.");
      return;
    }

    if (figFile) {
      setLoading(true);
      try {
        await onImportFigFile(figFile);
        closeImportFigmaModal();
        router.push("/editor");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Import failed.");
      } finally {
        setLoading(false);
      }
      return;
    }

    const trimmed = link.trim();
    if (!trimmed) {
      setError("Paste a Figma design link or choose a .fig file.");
      return;
    }

    if (!isFigmaDesignUrl(trimmed)) {
      setError("Enter a valid Figma design link (figma.com/design/… or /file/…).");
      return;
    }

    if (!accessToken.trim()) {
      setError("Add your Figma personal access token to import from a link.");
      return;
    }

    setLoading(true);
    try {
      writeFigmaAccessToken(accessToken);
      const doc = await importFigmaFromApi({
        accessToken: accessToken.trim(),
        url: trimmed,
      });
      const patch = documentToEditorPatch(doc);
      applyGeneratedDesign(
        { ...patch, fileName: doc.name || "Imported Figma" },
        "replace",
        { recordHistory: false },
      );
      closeImportFigmaModal();
      router.push("/editor");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Figma import failed.");
    } finally {
      setLoading(false);
    }
  }, [
    connectedEmail,
    figFile,
    link,
    accessToken,
    onImportFigFile,
    closeImportFigmaModal,
    router,
    applyGeneratedDesign,
  ]);

  if (!open) return null;

  const hasLink = link.trim().length > 0;
  const canImport = Boolean(
    connectedEmail && (figFile || (hasLink && accessToken.trim())),
  );

  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center bg-black/40 px-4 py-10 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-label="Import from Figma"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative flex w-full max-w-[440px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="absolute right-4 top-4 z-10 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
          aria-label="Close"
        >
          <X className="h-5 w-5" strokeWidth={1.75} />
        </button>

        <div className="flex flex-col items-center px-8 pb-2 pt-10 text-center">
          <FigmaLogoMark className="h-14 w-auto" />
          <h2 className="mt-5 text-[22px] font-semibold tracking-tight text-slate-900">
            Import from Figma
          </h2>
          <p className="mt-2 max-w-[320px] text-[14px] leading-relaxed text-slate-500">
            Paste a design link to turn frames into editable layers on the canvas.
          </p>
        </div>

        <div className="mx-6 mb-2 overflow-hidden rounded-xl border border-slate-200 bg-slate-50/50">
          <section className="px-5 py-4">
            <h3 className="text-[14px] font-semibold text-slate-900">Copy a Figma frame link</h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">
              Copy a design link from Figma with{" "}
              <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-sans text-[11px] text-slate-700">
                {modKeyLabel()}
              </kbd>{" "}
              <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-sans text-[11px] text-slate-700">
                L
              </kbd>{" "}
              and paste it below. Or upload a local{" "}
              <span className="font-medium text-slate-800">.fig</span> export.
            </p>
          </section>

          <div className="h-px bg-slate-200" />

          <section className="px-5 py-4">
            <h3 className="text-[14px] font-semibold text-slate-900">Pixel-accurate import</h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">
              Link import uses the Figma API for full layer trees, auto layout, hug/fill sizing,
              components, fills, and images — similar to MagicPath.
            </p>
          </section>

          <div className="h-px bg-slate-200" />

          <section className="px-5 py-4">
            <h3 className="text-[14px] font-semibold text-slate-900">Connection</h3>
            {connectedEmail ? (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px]">
                <span className="inline-flex items-center gap-1.5 text-slate-700">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden />
                  Connected to {connectedEmail}
                </span>
                <button
                  type="button"
                  onClick={onUnlink}
                  className="font-medium text-red-600 hover:text-red-700"
                >
                  unlink
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onConnect}
                className="mt-2 text-[13px] font-medium text-sky-700 hover:text-sky-800"
              >
                Connect Figma account
              </button>
            )}
            <label className="mt-3 block">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Personal access token
              </span>
              <input
                type="password"
                value={accessToken}
                onChange={(e) => {
                  setAccessToken(e.target.value);
                  setError(null);
                }}
                placeholder="figd_…"
                autoComplete="off"
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 font-mono text-[12px] text-slate-900 outline-none ring-slate-900/10 placeholder:text-slate-400 focus:border-slate-300 focus:ring-2"
              />
              <span className="mt-1 block text-[11px] text-slate-500">
                Create one at{" "}
                <a
                  href="https://www.figma.com/developers/api#access-tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-700 underline"
                >
                  figma.com/developers
                </a>
                . Stored locally in this browser only.
              </span>
            </label>
          </section>

          <div className="border-t border-slate-200 bg-white px-5 py-4">
            <input
              type="url"
              value={link}
              onChange={(e) => {
                setLink(e.target.value);
                setError(null);
              }}
              placeholder="Link to your Figma design"
              className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-[14px] text-slate-900 outline-none ring-slate-900/10 placeholder:text-slate-400 focus:border-slate-300 focus:ring-2"
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="text-[12px] font-medium text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline"
              >
                {figFile ? figFile.name : "Choose .fig file instead…"}
              </button>
              {figFile ? (
                <button
                  type="button"
                  onClick={() => setFigFile(null)}
                  className="text-[12px] text-slate-400 hover:text-slate-600"
                >
                  Clear
                </button>
              ) : null}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".fig,application/octet-stream"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) {
                  setFigFile(f);
                  setError(null);
                }
              }}
            />
          </div>
        </div>

        {error ? (
          <p className="mx-6 mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] leading-relaxed text-amber-900">
            {error}
          </p>
        ) : null}

        <div className="px-6 pb-8 pt-2">
          <button
            type="button"
            disabled={loading || !canImport}
            onClick={() => void runImport()}
            className={cn(
              "h-12 w-full rounded-xl text-[15px] font-semibold text-white shadow-sm transition-colors",
              canImport
                ? "bg-[#8faf7e] hover:bg-[#7d9d6c]"
                : "cursor-not-allowed bg-slate-300",
              loading && "opacity-70",
            )}
          >
            {loading ? "Importing…" : "Import design"}
          </button>
        </div>
      </div>
    </div>
  );
}
