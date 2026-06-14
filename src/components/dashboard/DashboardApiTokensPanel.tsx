"use client";

import { useMemo, useState } from "react";
import { KeyRound, Trash2 } from "lucide-react";
import type { CraftApiTokenSummary } from "@/lib/apiClient";
import type { ApiTokenResourceScope, ApiTokenScope } from "@/lib/apiTokenManagement";
import {
  API_TOKEN_EXPIRY_PRESETS,
  API_TOKEN_RESOURCE_SCOPE_OPTIONS,
  API_TOKEN_SCOPE_OPTIONS,
  formatApiTokenExpiry,
  formatApiTokenLastUsed,
  formatApiTokenScopes,
} from "@/lib/apiTokenManagement";
import { cn } from "@/lib/utils";

export function DashboardApiTokensPanel({
  tokens,
  loading,
  onCreate,
  onRevoke,
}: {
  tokens: CraftApiTokenSummary[];
  loading?: boolean;
  onCreate: (
    name: string,
    expiresInDays: number | null,
    scope: ApiTokenScope,
    resourceScopes: ApiTokenResourceScope[],
  ) => Promise<void>;
  onRevoke: (tokenId: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [expiryPreset, setExpiryPreset] = useState<string>("none");
  const [scopeMode, setScopeMode] = useState<"preset" | "custom">("preset");
  const [scope, setScope] = useState<ApiTokenScope>("write");
  const [resourceScopes, setResourceScopes] = useState<ApiTokenResourceScope[]>([]);
  const [creating, setCreating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const expiryDays = useMemo(() => {
    const preset = API_TOKEN_EXPIRY_PRESETS.find((p) => String(p.days ?? "none") === expiryPreset);
    return preset?.days ?? null;
  }, [expiryPreset]);

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      window.alert("Enter a name for this token (e.g. CI deploy).");
      return;
    }
    setCreating(true);
    try {
      const customScopes = scopeMode === "custom" ? resourceScopes : [];
      if (scopeMode === "custom" && customScopes.length === 0) {
        window.alert("Select at least one permission for a custom-scoped token.");
        return;
      }
      await onCreate(trimmed, expiryDays, scope, customScopes);
      setName("");
      setExpiryPreset("none");
      setScope("write");
      setScopeMode("preset");
      setResourceScopes([]);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Could not create token.");
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (tokenId: string, tokenName: string) => {
    if (!window.confirm(`Revoke token "${tokenName}"? Scripts using it will stop working.`)) return;
    setRevokingId(tokenId);
    try {
      await onRevoke(tokenId);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Could not revoke token.");
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <section className="mt-10 border-t border-app-border-subtle pt-8">
      <div className="mb-4 flex items-start gap-2">
        <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-app-muted" strokeWidth={1.75} />
        <div>
          <h2 className="section-heading text-app-muted">API tokens</h2>
          <p className="mt-1 text-ui-sm text-app-muted">
            Personal access tokens for CI, scripts, and automation. Use{" "}
            <code className="rounded bg-app-inset px-1 py-0.5 text-ui">Authorization: Bearer craft_pat_…</code> on
            the API and as <code className="rounded bg-app-inset px-1 py-0.5 text-ui">sessionToken</code> for
            realtime sync.
          </p>
        </div>
      </div>

      {loading ? <p className="mb-4 text-ui-sm text-app-muted">Loading tokens…</p> : null}

      <div className="mb-6 overflow-hidden rounded-xl border border-app-border bg-app-card shadow-sm">
        <table className="w-full text-left text-ui-sm">
          <thead className="border-b border-app-border-subtle bg-app-raised section-heading text-app-muted">
            <tr>
              <th className="px-4 py-2.5">Name</th>
              <th className="px-4 py-2.5">Prefix</th>
              <th className="px-4 py-2.5">Scope</th>
              <th className="px-4 py-2.5">Expires</th>
              <th className="px-4 py-2.5">Last used</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {tokens.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-app-muted">
                  No tokens yet. Create one below for headless access.
                </td>
              </tr>
            ) : (
              tokens.map((t) => (
                <tr key={t.id} className="border-b border-app-border-subtle last:border-0">
                  <td className="px-4 py-3 font-medium text-app-fg">{t.name}</td>
                  <td className="px-4 py-3 font-mono text-ui text-app-muted">{t.tokenPrefix}…</td>
                  <td className="px-4 py-3 text-app-muted">
                    {formatApiTokenScopes(t.scope, t.resourceScopes ?? [])}
                  </td>
                  <td className="px-4 py-3 text-app-muted">{formatApiTokenExpiry(t.expiresAt)}</td>
                  <td className="px-4 py-3 text-app-muted">{formatApiTokenLastUsed(t.lastUsedAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      disabled={revokingId === t.id}
                      onClick={() => void handleRevoke(t.id, t.name)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md border border-app-border px-2 py-1 text-ui font-medium text-app-muted transition-colors hover:bg-app-inset hover:text-app-fg",
                        revokingId === t.id && "opacity-50",
                      )}
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                      Revoke
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-app-border bg-app-card p-4 shadow-sm">
        <h3 className="text-ui font-semibold text-app-fg">Create token</h3>
        <p className="mt-1 text-ui text-app-muted">
          The full secret is shown once. Store it in your CI secrets or <code className="text-ui">CRAFT_API_TOKEN</code>.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-ui font-medium text-app-muted">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="CI deploy"
              className="h-9 rounded-lg border border-app-border bg-app-raised px-3 text-ui-sm text-app-fg outline-none ring-slate-900/10 focus:border-slate-300 focus:ring-2"
            />
          </label>
          <label className="flex w-full flex-col gap-1 sm:w-40">
            <span className="text-ui font-medium text-app-muted">Scope mode</span>
            <select
              value={scopeMode}
              onChange={(e) => setScopeMode(e.target.value as "preset" | "custom")}
              className="h-9 cursor-pointer rounded-lg border border-app-border bg-app-raised px-3 text-ui-sm text-app-fg outline-none ring-slate-900/10 focus:border-slate-300 focus:ring-2"
            >
              <option value="preset">Preset</option>
              <option value="custom">Custom</option>
            </select>
          </label>
          {scopeMode === "preset" ? (
            <label className="flex w-full flex-col gap-1 sm:w-44">
              <span className="text-ui font-medium text-app-muted">Scope</span>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value as ApiTokenScope)}
                className="h-9 cursor-pointer rounded-lg border border-app-border bg-app-raised px-3 text-ui-sm text-app-fg outline-none ring-slate-900/10 focus:border-slate-300 focus:ring-2"
              >
                {API_TOKEN_SCOPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="flex w-full flex-col gap-1 sm:w-40">
            <span className="text-ui font-medium text-app-muted">Expires</span>
            <select
              value={expiryPreset}
              onChange={(e) => setExpiryPreset(e.target.value)}
              className="h-9 cursor-pointer rounded-lg border border-app-border bg-app-raised px-3 text-ui-sm text-app-fg outline-none ring-slate-900/10 focus:border-slate-300 focus:ring-2"
            >
              {API_TOKEN_EXPIRY_PRESETS.map((preset) => (
                <option key={preset.label} value={String(preset.days ?? "none")}>
                  {preset.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={creating}
            onClick={() => void handleCreate()}
            className="h-9 shrink-0 rounded-lg bg-app-fg px-4 text-ui-sm font-semibold text-app-bg hover:bg-app-muted disabled:opacity-50"
          >
            {creating ? "Creating…" : "Create token"}
          </button>
        </div>
        {scopeMode === "custom" ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {API_TOKEN_RESOURCE_SCOPE_OPTIONS.map((option) => {
              const checked = resourceScopes.includes(option.value);
              return (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-start gap-2 rounded-lg border border-app-border-subtle bg-app-raised px-3 py-2 text-ui-sm"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      setResourceScopes((prev) =>
                        e.target.checked
                          ? [...prev, option.value]
                          : prev.filter((s) => s !== option.value),
                      );
                    }}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="font-medium text-app-fg">{option.label}</span>
                    <span className="mt-0.5 block text-ui text-app-muted">{option.group}</span>
                  </span>
                </label>
              );
            })}
          </div>
        ) : null}
      </div>
    </section>
  );
}
