"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Eye, EyeOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { appFieldClass } from "@/lib/appFieldStyles";
import { aiKeyProvider } from "@/lib/aiKeys/providers";
import { maskAIKey, removeAIKey, setActiveAIKey, saveAIKey, getActiveKeyForProvider } from "@/lib/aiKeys/storage";
import type { AIKeyProviderId } from "@/lib/aiKeys/types";
import { useAIKeys } from "@/components/ai/useAIKeys";
import { cn } from "@/lib/utils";

export function AIAddKeyModal() {
  const { modal, addProvider, closeModals, finishAddKey } = useAIKeys();
  const [value, setValue] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const open = modal === "add" && addProvider != null;
  const provider = addProvider ? aiKeyProvider(addProvider) : null;

  useEffect(() => {
    if (!open) {
      setValue("");
      setVisible(false);
      setError(null);
    }
  }, [open, addProvider]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModals();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeModals]);

  if (!open || !provider) return null;

  const onSave = () => {
    setError(null);
    if (!value.trim()) {
      setError("Enter an API key.");
      return;
    }
    setSaving(true);
    try {
      saveAIKey({ provider: provider.id, key: value });
      finishAddKey();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save key.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[230] flex items-center justify-center bg-black/55 px-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label={`Add ${provider.label} key`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeModals();
      }}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-app-border bg-app-panel shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={closeModals}
          className="absolute right-3 top-3 rounded-lg p-1.5 text-app-muted hover:bg-app-hover hover:text-app-fg"
          aria-label="Close"
        >
          <X className="h-5 w-5" strokeWidth={1.75} />
        </button>

        <header className="border-b border-app-border-subtle px-5 pb-4 pt-5 pr-12">
          <h2 className="text-lg font-semibold text-app-fg">Add your {provider.label} key</h2>
          <p className="mt-1 text-ui text-app-muted">
            Stored on this device. Forwarded to {provider.label} on each request, billed to your
            account.
          </p>
        </header>

        <div className="space-y-3 px-5 py-4">
          <label className="block">
            <div className="relative">
              <input
                type={visible ? "text" : "password"}
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  setError(null);
                }}
                placeholder={provider.placeholder}
                autoComplete="off"
                className={cn(appFieldClass, "pr-10 font-mono text-ui-sm")}
              />
              <button
                type="button"
                onClick={() => setVisible((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-app-muted hover:text-app-fg"
                aria-label={visible ? "Hide key" : "Show key"}
              >
                {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>

          <a
            href={provider.getKeyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-ui text-app-muted hover:text-app-fg"
          >
            Get a key
            <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
          </a>

          {error ? <p className="text-ui text-red-400">{error}</p> : null}
        </div>

        <footer className="flex justify-end gap-2 border-t border-app-border-subtle px-5 py-3">
          <Button type="button" variant="toolbar" onClick={closeModals} className="h-9">
            Cancel
          </Button>
          <Button
            type="button"
            disabled={saving}
            onClick={onSave}
            className="h-9 bg-app-fg text-app-bg hover:brightness-95"
          >
            Save key
          </Button>
        </footer>
      </div>
    </div>
  );
}

export function AIKeysManageModal() {
  const {
    modal,
    version,
    closeModals,
    openAddKey,
    refresh,
    isProviderConfigured,
    keysForProvider: listKeys,
  } = useAIKeys();
  const open = modal === "manage";
  const [serverConfigured, setServerConfigured] = useState<
    Partial<Record<AIKeyProviderId, boolean>>
  >({});

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/v1/ai/models");
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          openai?: { configured: boolean };
          cursor?: { configured: boolean };
        };
        if (cancelled) return;
        setServerConfigured({
          openai: data.openai?.configured ?? false,
          cursor: data.cursor?.configured ?? false,
          anthropic: false,
        });
      } catch {
        /* keep local-only status */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, version]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModals();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeModals]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[230] flex items-center justify-center bg-black/55 px-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Your AI keys"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeModals();
      }}
    >
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-app-border bg-app-panel shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={closeModals}
          className="absolute right-3 top-3 rounded-lg p-1.5 text-app-muted hover:bg-app-hover hover:text-app-fg"
          aria-label="Close"
        >
          <X className="h-5 w-5" strokeWidth={1.75} />
        </button>

        <header className="border-b border-app-border-subtle px-5 pb-4 pt-5 pr-12">
          <h2 className="text-lg font-semibold text-app-fg">Your AI keys</h2>
        </header>

        <div className="thin-scroll max-h-[min(60dvh,420px)] space-y-3 overflow-y-auto px-5 py-4">
          {(["openai", "cursor", "anthropic"] as AIKeyProviderId[]).map((providerId) => {
            const provider = aiKeyProvider(providerId);
            const keys = listKeys(providerId);
            const serverReady = serverConfigured[providerId] ?? false;
            const hasLocalKeys = keys.length > 0;
            const configured = isProviderConfigured(providerId, serverReady);
            const serverOnly = serverReady && !hasLocalKeys;
            return (
              <section
                key={providerId}
                className="rounded-xl border border-app-border bg-app-inset px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-ui font-medium text-app-fg">{provider.label}</p>
                      {hasLocalKeys ? (
                        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-ui-sm text-emerald-400">
                          Key saved
                        </span>
                      ) : null}
                    </div>
                    {!configured ? (
                      <a
                        href={provider.getKeyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-0.5 inline-flex items-center gap-1 text-ui-sm text-app-muted hover:text-app-fg"
                      >
                        Get a key
                        <ExternalLink className="h-3 w-3" strokeWidth={2} />
                      </a>
                    ) : null}
                  </div>
                  {!serverOnly ? (
                    <button
                      type="button"
                      onClick={() => openAddKey(providerId, { returnToManage: true })}
                      className="shrink-0 rounded-md border border-app-border bg-app-panel px-2 py-1 text-ui-sm text-app-muted hover:bg-app-hover hover:text-app-fg"
                    >
                      {hasLocalKeys ? "+ Add another" : "+ Add key"}
                    </button>
                  ) : null}
                </div>

                {serverOnly ? (
                  <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-app-border-subtle bg-app-panel px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-ui-sm font-medium text-app-fg">
                        Server key
                        <span className="ml-1.5 text-ui-sm font-normal text-emerald-400">Active</span>
                      </p>
                      <p className="truncate text-ui-sm text-app-subtle">Set in .env.local</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openAddKey(providerId, { returnToManage: true })}
                      className="shrink-0 text-ui-sm text-app-muted hover:text-app-fg"
                    >
                      Add device key
                    </button>
                  </div>
                ) : null}

                {!configured ? (
                  <p className="mt-2 text-ui-sm text-app-subtle">No key added yet.</p>
                ) : null}

                {hasLocalKeys ? (
                  <ul className="mt-3 space-y-2">
                    {keys.map((key) => {
                      const active = getActiveKeyForProvider(providerId)?.id === key.id;
                      return (
                      <li
                        key={key.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-app-border-subtle bg-app-panel px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-ui-sm font-medium text-app-fg">
                            {key.label}
                            {active ? (
                              <span className="ml-1.5 text-ui-sm font-normal text-emerald-400">
                                Active
                              </span>
                            ) : null}
                          </p>
                          <p className="truncate font-mono text-ui-sm text-app-subtle">
                            {maskAIKey(key.key)}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {!active ? (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveAIKey(providerId, key.id);
                                refresh();
                              }}
                              className="text-ui-sm text-app-muted hover:text-app-fg"
                            >
                              Use
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => {
                              removeAIKey(key.id);
                              refresh();
                            }}
                            className="text-ui-sm text-red-400 hover:text-red-300"
                          >
                            Remove
                          </button>
                        </div>
                      </li>
                    );
                    })}
                  </ul>
                ) : null}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
