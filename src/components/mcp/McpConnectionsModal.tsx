"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Link2,
  Loader2,
  Plus,
  Trash2,
  Unplug,
  Wrench,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { appFieldClass } from "@/lib/appFieldStyles";
import { callMcpToolApi, fetchMcpCapabilities, testMcpConnectionApi } from "@/lib/mcp/mcpApiClient";
import {
  newMcpConnectionId,
  readMcpConnections,
  removeMcpConnection,
  upsertMcpConnection,
} from "@/lib/mcp/mcpConnectionStorage";
import { MCP_PRESET_TEMPLATES, MCP_PRODUCTS, productDef } from "@/lib/mcp/presets";
import {
  canvasActionDescription,
  canvasActionLabel,
  detectMcpProduct,
} from "@/lib/mcp/productBindings";
import type {
  McpCanvasActionId,
  McpConnectionConfig,
  McpConnectionRequest,
  McpProductId,
  McpTransportKind,
} from "@/lib/mcp/types";
import { useEditorStore } from "@/stores/useEditorStore";
import { cn } from "@/lib/utils";

function parseJsonRecord(raw: string): Record<string, string> | null {
  const trimmed = raw.trim();
  if (!trimmed) return {};
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "string") out[k] = v;
      else if (v != null) out[k] = String(v);
    }
    return out;
  } catch {
    return null;
  }
}

function emptyDraft(presetId?: string): McpConnectionConfig {
  const preset = MCP_PRESET_TEMPLATES.find((p) => p.id === presetId) ?? MCP_PRESET_TEMPLATES[0]!;
  return {
    id: newMcpConnectionId(),
    name: preset.defaults.name ?? preset.label,
    productId: preset.productId,
    transport: preset.transport,
    url: preset.defaults.url ?? "",
    headers: preset.defaults.headers ?? {},
    command: preset.defaults.command ?? "",
    args: preset.defaults.args ?? [],
    env: preset.defaults.env ?? {},
    enabled: true,
  };
}

export function McpConnectionsModal() {
  const open = useEditorStore((s) => s.mcpConnectionsModalOpen);
  const close = useEditorStore((s) => s.closeMcpConnectionsModal);
  const openImportFigmaModal = useEditorStore((s) => s.openImportFigmaModal);
  const openCodeRoundTrip = useEditorStore((s) => s.openCodeRoundTrip);
  const openImportHub = useEditorStore((s) => s.openImportHub);

  const [connections, setConnections] = useState<McpConnectionConfig[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<McpConnectionConfig>(() => emptyDraft());
  const [headersJson, setHeadersJson] = useState("{}");
  const [envJson, setEnvJson] = useState("{}");
  const [argsText, setArgsText] = useState("");
  const [stdioAllowed, setStdioAllowed] = useState(true);
  const [testing, setTesting] = useState(false);
  const [runningTool, setRunningTool] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [selectedTool, setSelectedTool] = useState("");
  const [toolArgsJson, setToolArgsJson] = useState("{}");
  const [toolResult, setToolResult] = useState<string | null>(null);

  const loadDraft = useCallback((c: McpConnectionConfig) => {
    setDraft(c);
    setHeadersJson(JSON.stringify(c.headers ?? {}, null, 2));
    setEnvJson(JSON.stringify(c.env ?? {}, null, 2));
    setArgsText((c.args ?? []).join(" "));
    setSelectedTool(c.toolNames?.[0] ?? "");
    setToolArgsJson("{}");
    setToolResult(null);
    setError(null);
    setStatus(c.lastStatus ?? null);
  }, []);

  useEffect(() => {
    if (!open) return;
    const list = readMcpConnections();
    setConnections(list);
    void fetchMcpCapabilities().then((caps) => setStdioAllowed(caps.stdioAllowed));
    if (list.length > 0) {
      const first = list[0]!;
      setSelectedId(first.id);
      loadDraft(first);
    } else {
      const next = emptyDraft();
      setSelectedId(next.id);
      loadDraft(next);
    }
  }, [open, loadDraft]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  const requestPayload = useMemo((): McpConnectionRequest | null => {
    const headers = parseJsonRecord(headersJson);
    const env = parseJsonRecord(envJson);
    if (headers === null || env === null) return null;
    return {
      ...draft,
      headers,
      env,
      args: argsText.trim() ? argsText.trim().split(/\s+/) : [],
    };
  }, [draft, headersJson, envJson, argsText]);

  const detectedProduct = useMemo(() => {
    const tools = (draft.toolNames ?? []).map((name) => ({ name }));
    return detectMcpProduct(tools, draft.productId);
  }, [draft.toolNames, draft.productId]);

  const product = productDef(detectedProduct);

  const onSave = () => {
    if (!requestPayload) {
      setError("Headers and env must be valid JSON objects.");
      return;
    }
    const saved: McpConnectionConfig = {
      ...draft,
      ...requestPayload,
    };
    const next = upsertMcpConnection(saved);
    setConnections(next);
    setSelectedId(saved.id);
    setStatus("Saved.");
    setError(null);
  };

  const onTest = async () => {
    if (!requestPayload) {
      setError("Headers and env must be valid JSON objects.");
      return;
    }
    setTesting(true);
    setError(null);
    setStatus(null);
    try {
      const result = await testMcpConnectionApi(requestPayload);
      if (!result.ok) {
        setError(result.error ?? "Connection failed.");
        return;
      }
      const updated: McpConnectionConfig = {
        ...draft,
        ...requestPayload,
        productId: result.productId,
        lastConnectedAt: new Date().toISOString(),
        toolNames: result.tools.map((t) => t.name),
        lastStatus: result.message ?? "Connected.",
      };
      setDraft(updated);
      const next = upsertMcpConnection(updated);
      setConnections(next);
      setSelectedTool(result.tools[0]?.name ?? "");
      setStatus(result.message ?? "Connected.");
    } finally {
      setTesting(false);
    }
  };

  const onDelete = () => {
    if (!selectedId) return;
    const next = removeMcpConnection(selectedId);
    setConnections(next);
    if (next.length > 0) {
      setSelectedId(next[0]!.id);
      loadDraft(next[0]!);
    } else {
      const fresh = emptyDraft();
      setSelectedId(fresh.id);
      loadDraft(fresh);
    }
  };

  const onNew = (presetId?: string) => {
    const next = emptyDraft(presetId);
    setSelectedId(next.id);
    loadDraft(next);
  };

  const onRunTool = async () => {
    if (!requestPayload || !selectedTool) return;
    const args = parseJsonRecord(toolArgsJson);
    if (args === null) {
      setError("Tool arguments must be a JSON object.");
      return;
    }
    setRunningTool(true);
    setToolResult(null);
    setError(null);
    try {
      const result = await callMcpToolApi(requestPayload, selectedTool, args);
      if (!result.ok) {
        setError(result.error ?? "Tool call failed.");
        return;
      }
      const lines = result.content.map((block) => {
        if (block.type === "text") return block.text;
        if (block.type === "image") return `[Image ${block.mimeType}, ${block.data.length} chars base64]`;
        if (block.type === "resource") return block.text ?? `[Resource ${block.uri}]`;
        return JSON.stringify(block.raw ?? block, null, 2);
      });
      setToolResult(lines.join("\n\n") || "(empty response)");
    } finally {
      setRunningTool(false);
    }
  };

  const runCanvasAction = (action: McpCanvasActionId) => {
    close();
    switch (action) {
      case "open-figma-import":
        openImportFigmaModal();
        break;
      case "open-code-bridge":
        openCodeRoundTrip("import");
        break;
      case "open-import-hub":
        openImportHub();
        break;
      case "run-tool":
        break;
      default:
        break;
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center bg-black/55 px-3 py-6 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="MCP connections"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className="relative flex max-h-[min(92dvh,760px)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-app-border bg-app-panel text-app-fg shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-app-border-subtle px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-app-border-subtle bg-app-inset text-sky-300">
              <Link2 className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">MCP connections</h2>
              <p className="mt-0.5 max-w-xl text-ui text-app-muted">
                Connect any MCP server to your canvas. HTTP works on production; stdio requires
                local or self-hosted Craft.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            className="rounded-lg p-1.5 text-app-muted transition-colors hover:bg-app-hover hover:text-app-fg"
            aria-label="Close"
          >
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 md:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="thin-scroll flex min-h-0 flex-col border-b border-app-border-subtle md:border-b-0 md:border-r">
            <div className="flex items-center justify-between px-3 py-2">
              <p className="section-heading">Connected</p>
              <button
                type="button"
                onClick={() => onNew()}
                className="rounded-md p-1 text-app-muted hover:bg-app-hover hover:text-app-fg"
                title="Add connection"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <div className="thin-scroll min-h-0 flex-1 space-y-1 px-2 pb-2">
              {connections.length === 0 ? (
                <p className="px-2 py-3 text-ui-sm text-app-muted">No saved connections yet.</p>
              ) : (
                connections.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(c.id);
                      loadDraft(c);
                    }}
                    className={cn(
                      "flex w-full flex-col items-start rounded-lg px-2.5 py-2 text-left transition-colors",
                      selectedId === c.id ? "bg-app-hover text-app-fg" : "text-app-muted hover:bg-app-inset",
                    )}
                  >
                    <span className="truncate text-ui font-medium">{c.name}</span>
                    <span className="truncate text-ui-sm text-app-subtle">
                      {productDef(c.productId).label} · {c.transport.toUpperCase()}
                    </span>
                  </button>
                ))
              )}
            </div>
            <div className="border-t border-app-border-subtle p-2">
              <p className="mb-1.5 px-1 section-heading">Add preset</p>
              <div className="flex flex-wrap gap-1">
                {MCP_PRESET_TEMPLATES.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onNew(p.id)}
                    className="rounded-md border border-app-border bg-app-inset px-2 py-1 text-ui-sm text-app-muted hover:bg-app-hover hover:text-app-fg"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <div className="thin-scroll min-h-0 space-y-4 overflow-y-auto px-5 py-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="section-heading">Name</span>
                <input
                  className={cn(appFieldClass, "mt-1")}
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                />
              </label>
              <label className="block">
                <span className="section-heading">Product</span>
                <select
                  className={cn(appFieldClass, "mt-1")}
                  value={draft.productId}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, productId: e.target.value as McpProductId }))
                  }
                >
                  {MCP_PRODUCTS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="section-heading">Transport</span>
                <select
                  className={cn(appFieldClass, "mt-1")}
                  value={draft.transport}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, transport: e.target.value as McpTransportKind }))
                  }
                >
                  <option value="http">HTTP (production)</option>
                  <option value="stdio" disabled={!stdioAllowed}>
                    Stdio {stdioAllowed ? "(local)" : "(disabled on server)"}
                  </option>
                </select>
              </label>
            </div>

            {draft.transport === "http" ? (
              <>
                <label className="block">
                  <span className="section-heading">MCP URL</span>
                  <input
                    className={cn(appFieldClass, "mt-1 font-mono text-ui-sm")}
                    value={draft.url ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))}
                    placeholder="https://api.example.com/mcp"
                  />
                </label>
                <label className="block">
                  <span className="section-heading">Headers (JSON)</span>
                  <textarea
                    className={cn(appFieldClass, "mt-1 min-h-[72px] font-mono text-ui-sm")}
                    value={headersJson}
                    onChange={(e) => setHeadersJson(e.target.value)}
                    spellCheck={false}
                  />
                </label>
              </>
            ) : (
              <>
                <label className="block">
                  <span className="section-heading">Command</span>
                  <input
                    className={cn(appFieldClass, "mt-1 font-mono text-ui-sm")}
                    value={draft.command ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, command: e.target.value }))}
                    placeholder="npx"
                  />
                </label>
                <label className="block">
                  <span className="section-heading">Args (space-separated)</span>
                  <input
                    className={cn(appFieldClass, "mt-1 font-mono text-ui-sm")}
                    value={argsText}
                    onChange={(e) => setArgsText(e.target.value)}
                    placeholder="-y @modelcontextprotocol/server-github"
                  />
                </label>
                <label className="block">
                  <span className="section-heading">Env (JSON)</span>
                  <textarea
                    className={cn(appFieldClass, "mt-1 min-h-[72px] font-mono text-ui-sm")}
                    value={envJson}
                    onChange={(e) => setEnvJson(e.target.value)}
                    spellCheck={false}
                  />
                </label>
              </>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="toolbar"
                disabled={testing}
                onClick={() => void onTest()}
                className="h-9 gap-1.5 border border-app-border bg-app-panel"
              >
                {testing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                )}
                Test connection
              </Button>
              <Button
                type="button"
                variant="toolbar"
                onClick={onSave}
                className="h-9 border border-app-border bg-app-panel"
              >
                Save
              </Button>
              {connections.some((c) => c.id === selectedId) ? (
                <Button
                  type="button"
                  variant="toolbar"
                  onClick={onDelete}
                  className="h-9 gap-1.5 border border-red-500/30 text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 className="h-4 w-4" />
                  Remove
                </Button>
              ) : null}
            </div>

            {error ? <p className="text-ui text-red-400">{error}</p> : null}
            {status ? (
              <p className="flex items-center gap-1.5 text-ui text-emerald-400">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                {status}
              </p>
            ) : null}

            {draft.toolNames && draft.toolNames.length > 0 ? (
              <section className="overflow-hidden rounded-xl border border-app-border bg-app-inset">
                <div className="border-b border-app-border-subtle px-4 py-3">
                  <p className="section-heading">Canvas actions · {product.label}</p>
                  <p className="mt-1 text-ui-sm text-app-muted">{product.description}</p>
                </div>
                <div className="grid gap-2 p-4 sm:grid-cols-2">
                  {product.canvasActions.map((action) => (
                    <button
                      key={action}
                      type="button"
                      onClick={() => runCanvasAction(action)}
                      className="rounded-lg border border-app-border bg-app-panel px-3 py-2.5 text-left transition-colors hover:bg-app-hover"
                    >
                      <span className="text-ui font-medium text-app-fg">
                        {canvasActionLabel(action)}
                      </span>
                      <p className="mt-0.5 text-ui-sm text-app-muted">
                        {canvasActionDescription(action, product.id)}
                      </p>
                    </button>
                  ))}
                </div>

                <div className="border-t border-app-border-subtle px-4 py-3">
                  <p className="section-heading">Run MCP tool</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <select
                      className={appFieldClass}
                      value={selectedTool}
                      onChange={(e) => setSelectedTool(e.target.value)}
                    >
                      {draft.toolNames.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      variant="toolbar"
                      disabled={runningTool || !selectedTool}
                      onClick={() => void onRunTool()}
                      className="h-9 gap-1.5 border border-app-border"
                    >
                      {runningTool ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Wrench className="h-4 w-4" />
                      )}
                      Run
                    </Button>
                  </div>
                  <textarea
                    className={cn(appFieldClass, "mt-2 min-h-[64px] font-mono text-ui-sm")}
                    value={toolArgsJson}
                    onChange={(e) => setToolArgsJson(e.target.value)}
                    placeholder='{"key": "value"}'
                    spellCheck={false}
                  />
                  {toolResult ? (
                    <pre className="thin-scroll mt-2 max-h-40 overflow-auto rounded-lg border border-app-border bg-black/30 p-3 text-ui-sm text-app-fg">
                      {toolResult}
                    </pre>
                  ) : null}
                </div>
              </section>
            ) : (
              <div className="flex items-start gap-2 rounded-xl border border-dashed border-app-border px-4 py-3 text-ui-sm text-app-muted">
                <Unplug className="mt-0.5 h-4 w-4 shrink-0" />
                Test a connection to discover tools and unlock canvas actions for this product.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
