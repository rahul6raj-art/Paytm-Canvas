"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { createPortal } from "react-dom";
import { ArrowUp, FileText, Paperclip, Plus, Sparkles, Zap } from "lucide-react";
import { AIContextAttachments } from "@/components/ai/AIContextAttachments";
import { AIStyleGuideSelect } from "@/components/ai/AIStyleGuideSelect";
import { AIModelPillSelect } from "@/components/ai/AIModelPillSelect";
import { FloatingPillSelect } from "@/components/ai/FloatingPillSelect";
import { MITRA_SCREEN_PRESETS, useMitraAIGenerate } from "@/components/ai/useMitraAIGenerate";
import type { AIContextKind } from "@/lib/aiGenerateContext";
import { SidebarCollapsibleSection } from "./SidebarCollapsibleSection";
import {
  anchoredMenuStyle,
  useAnchoredDropdownPosition,
  useDismissAnchoredDropdown,
} from "./useAnchoredDropdown";
import { cn } from "@/lib/utils";
import { EditorHintWrap } from "./EditorHoverHint";

const MITRA_MENU_Z = "z-[120]";
const MITRA_PROMPT_PLACEHOLDER = "Ask Mitra to create...";
const MITRA_COMPOSER_BOX_MAX_HEIGHT_PX = 200;
const MITRA_TEXTAREA_MIN_HEIGHT_PX = 48;
const MITRA_HEADER_HEIGHT_PX = 40;
/** Footer wrapper padding (pt-2.5 + pt-2 + pb-3). */
const MITRA_FOOTER_CHROME_PX = 38;

function MitraPlusMenu({
  disabled,
  anchorRef,
  onAttachFile,
  onAttachSkills,
}: {
  disabled?: boolean;
  anchorRef: RefObject<HTMLButtonElement | null>;
  onAttachFile: () => void;
  onAttachSkills: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const position = useAnchoredDropdownPosition(anchorRef, open, 6, {
    viewportClamp: true,
    maxHeight: 240,
    width: 220,
  });
  useDismissAnchoredDropdown(open, () => setOpen(false), anchorRef, menuRef);

  useEffect(() => setMounted(true), []);

  const menu =
    open && mounted ? (
      <div
        ref={menuRef}
        role="menu"
        aria-label="Add context"
        data-editor-shell
        className={cn(
          "editor-floating-menu fixed overflow-y-auto overscroll-contain border border-app-border bg-app-panel py-1 shadow-lg",
          MITRA_MENU_Z,
        )}
        style={anchoredMenuStyle(position)}
      >
        <p className="section-heading px-3.5 py-2">Add to prompt</p>
        <button
          type="button"
          role="menuitem"
          disabled={disabled}
          className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-ui text-app-fg transition-colors hover:bg-app-hover disabled:opacity-40"
          onClick={() => {
            setOpen(false);
            onAttachFile();
          }}
        >
          <Paperclip className="h-4 w-4 shrink-0 text-app-muted" strokeWidth={1.75} />
          Attach file
        </button>
        <button
          type="button"
          role="menuitem"
          disabled={disabled}
          className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-ui text-app-fg transition-colors hover:bg-app-hover disabled:opacity-40"
          onClick={() => {
            setOpen(false);
            onAttachSkills();
          }}
        >
          <Sparkles className="h-4 w-4 shrink-0 text-app-muted" strokeWidth={1.75} />
          Skills
        </button>
      </div>
    ) : null;

  return (
    <>
      <EditorHintWrap title="Add context" disabled={disabled}>
        <button
          ref={anchorRef}
          type="button"
          aria-label="Add context"
          aria-haspopup="menu"
          aria-expanded={open}
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-app-subtle transition-colors hover:bg-app-hover hover:text-app-fg",
            open && "bg-app-hover text-app-fg",
          )}
        >
          <Plus className="h-4 w-4" strokeWidth={2} />
        </button>
      </EditorHintWrap>
      {menu && mounted ? createPortal(menu, document.body) : null}
    </>
  );
}

export function EditorSidebarJulesPanel({
  className,
  style,
  open,
  onOpenChange,
  onRequiredHeightChange,
}: {
  className?: string;
  style?: React.CSSProperties;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onRequiredHeightChange?: (height: number) => void;
}) {
  const plusAnchorRef = useRef<HTMLButtonElement>(null);
  const pickContextKindRef = useRef<((kind: AIContextKind) => void) | null>(null);
  const composerBoxRef = useRef<HTMLDivElement>(null);
  const composerToolbarRef = useRef<HTMLDivElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const contentMeasureRef = useRef<HTMLDivElement>(null);
  const footerIntrinsicRef = useRef<HTMLDivElement>(null);

  const {
    prompt,
    setPrompt,
    preset,
    setPreset,
    styleGuideMode,
    setStyleGuideMode,
    styleGuideTheme,
    setStyleGuideTheme,
    designMdRefs,
    handleDesignMdRefsChange,
    selectedDesignMdId,
    handleSelectedDesignMdIdChange,
    attachments,
    setAttachments,
    modelId,
    setModelId,
    attachMenuOpen,
    setAttachMenuOpen,
    styleGuideOpen,
    setStyleGuideOpen,
    generateError,
    contextCount,
    canGenerate,
    busy,
    runGenerate,
  } = useMitraAIGenerate();

  const reportIntrinsicHeight = useCallback(() => {
    if (!onRequiredHeightChange) return;
    const contentH = contentMeasureRef.current?.offsetHeight ?? 0;
    const footerH = footerIntrinsicRef.current?.offsetHeight ?? 0;
    onRequiredHeightChange(
      MITRA_HEADER_HEIGHT_PX + contentH + footerH + MITRA_FOOTER_CHROME_PX,
    );
  }, [onRequiredHeightChange]);

  useLayoutEffect(() => {
    const textarea = promptRef.current;
    const box = composerBoxRef.current;
    const toolbar = composerToolbarRef.current;
    if (!textarea || !box || !toolbar) return;

    textarea.style.height = "0px";
    const boxStyles = window.getComputedStyle(box);
    const verticalPadding =
      Number.parseFloat(boxStyles.paddingTop) + Number.parseFloat(boxStyles.paddingBottom);
    const gap = Number.parseFloat(window.getComputedStyle(box).rowGap || "0") || 8;
    const chromeHeight = verticalPadding + gap + toolbar.offsetHeight;
    const maxTextareaHeight = Math.max(
      MITRA_TEXTAREA_MIN_HEIGHT_PX,
      MITRA_COMPOSER_BOX_MAX_HEIGHT_PX - chromeHeight,
    );
    const nextHeight = Math.max(
      MITRA_TEXTAREA_MIN_HEIGHT_PX,
      Math.min(textarea.scrollHeight, maxTextareaHeight),
    );

    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxTextareaHeight ? "auto" : "hidden";
    reportIntrinsicHeight();
  }, [prompt, attachments.length, styleGuideMode, generateError, busy, reportIntrinsicHeight]);

  useLayoutEffect(() => {
    if (!onRequiredHeightChange) return;
    const targets = [footerIntrinsicRef.current, contentMeasureRef.current, composerBoxRef.current].filter(
      Boolean,
    ) as Element[];
    if (targets.length === 0) return;

    reportIntrinsicHeight();
    const ro = new ResizeObserver(() => reportIntrinsicHeight());
    for (const target of targets) ro.observe(target);
    return () => ro.disconnect();
  }, [
    onRequiredHeightChange,
    open,
    reportIntrinsicHeight,
    prompt,
    attachments.length,
    styleGuideMode,
    generateError,
    busy,
  ]);

  return (
    <SidebarCollapsibleSection
      title="Mitra"
      variant="card"
      open={open}
      defaultOpen
      hideFooterWhenCollapsed
      compactWhenCollapsed
      fillAvailable={false}
      footerFill
      onOpenChange={onOpenChange}
      sectionRef={sectionRef}
      className={cn("shrink-0", className)}
      style={style}
      contentClassName="flex flex-col gap-2.5 px-3.5 pt-2"
      footerClassName="flex min-h-0 min-w-0 flex-1 flex-col pb-3 pt-2"
      footer={
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1" aria-hidden />
          <div ref={footerIntrinsicRef} className="flex shrink-0 flex-col gap-2">
            <AIContextAttachments
              variant="minimal"
              minimalPart="chips"
              floatingMenuZClass={MITRA_MENU_Z}
              attachments={attachments}
              disabled={busy}
              onChange={setAttachments}
            />
            <div
              ref={composerBoxRef}
              className="flex min-w-0 shrink-0 flex-col-reverse gap-2 overflow-hidden rounded-2xl border border-app-border-subtle bg-app-inset px-2.5 pt-2 pb-2.5"
              style={{ maxHeight: MITRA_COMPOSER_BOX_MAX_HEIGHT_PX }}
            >
            <div
              ref={composerToolbarRef}
              className="flex min-w-0 shrink-0 items-center gap-1.5 overflow-hidden"
            >
              <MitraPlusMenu
                disabled={busy}
                anchorRef={plusAnchorRef}
                onAttachFile={() => setAttachMenuOpen(true)}
                onAttachSkills={() => pickContextKindRef.current?.("skills")}
              />
              <div className="min-w-0 flex-1 overflow-hidden">
                <AIModelPillSelect
                  icon={Sparkles}
                  value={modelId}
                  onChange={setModelId}
                  disabled={busy}
                  menuZClass={MITRA_MENU_Z}
                  truncateLabel
                  className="max-w-full min-w-0 text-ui"
                />
              </div>
              <EditorHintWrap title="Send to Mitra" disabled={!canGenerate || busy}>
                <button
                  type="button"
                  aria-label="Send"
                  disabled={!canGenerate || busy}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-app-fg text-app-bg transition-opacity disabled:opacity-30"
                  onClick={() => runGenerate()}
                >
                  <ArrowUp className="h-4 w-4" strokeWidth={2} />
                </button>
              </EditorHintWrap>
            </div>
            <textarea
              ref={promptRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={1}
              placeholder={MITRA_PROMPT_PLACEHOLDER}
              disabled={busy}
              className="min-h-12 w-full min-w-0 resize-none bg-transparent px-1 py-1 text-ui text-app-fg placeholder:text-app-muted focus:outline-none disabled:opacity-50"
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  runGenerate();
                }
              }}
            />
          </div>
          <div className="flex flex-col gap-4 pt-2">
            <div className="grid w-full grid-cols-2 gap-1.5 [&_button]:flex [&_button]:w-full [&_button>span]:min-w-0 [&_button>span]:max-w-none [&_button>span]:flex-1">
              <FloatingPillSelect
                icon={Zap}
                label="Screen"
                value={preset ?? ""}
                disabled={busy}
                menuZClass={MITRA_MENU_Z}
                className="text-ui"
                onChange={(v) => setPreset(v || undefined)}
                options={[
                  { value: "", label: "Any screen" },
                  ...MITRA_SCREEN_PRESETS.map((p) => ({ value: p, label: p })),
                ]}
              />
              <AIStyleGuideSelect
                disabled={busy}
                menuZClass={MITRA_MENU_Z}
                mode={styleGuideMode}
                onModeChange={setStyleGuideMode}
                designMdRefs={designMdRefs}
                onDesignMdRefsChange={handleDesignMdRefsChange}
                selectedDesignMdId={selectedDesignMdId}
                onSelectedDesignMdIdChange={handleSelectedDesignMdIdChange}
                theme={styleGuideTheme}
                onThemeChange={setStyleGuideTheme}
                controlledOpen={styleGuideOpen}
                onControlledOpenChange={setStyleGuideOpen}
                className="text-ui"
              />
            </div>
            <AIContextAttachments
              variant="minimal"
              minimalPart="button"
              hideAttachButton
              attachAnchorRef={plusAnchorRef}
              controlledMenuOpen={attachMenuOpen}
              onControlledMenuOpenChange={setAttachMenuOpen}
              floatingMenuZClass={MITRA_MENU_Z}
              excludeAttachKinds={["skills"]}
              pickKindRef={pickContextKindRef}
              attachments={attachments}
              disabled={busy}
              onChange={setAttachments}
            />
          </div>
          </div>
        </div>
      }
    >
      {styleGuideMode === "design-md" && contextCount === 0 && !busy ? (
        <div ref={contentMeasureRef} className="flex flex-col gap-2.5">
          <p className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-ui text-amber-100/90">
            <FileText className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
            Add a Style Guide so generation uses your brand tokens and typography.
          </p>
          {generateError ? (
            <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-ui text-rose-200">
              {generateError}
            </p>
          ) : null}
        </div>
      ) : generateError ? (
        <div ref={contentMeasureRef} className="flex flex-col gap-2.5">
          <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-ui text-rose-200">
            {generateError}
          </p>
        </div>
      ) : null}
    </SidebarCollapsibleSection>
  );
}
