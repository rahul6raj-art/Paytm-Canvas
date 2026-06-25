"use client";

import Link from "next/link";
import { useState } from "react";
import { apiClient, ApiRequestError } from "@/lib/apiClient";
import { authSecondaryLinkClassName } from "@/components/auth/AuthFormShell";
import { OAuthButtons } from "@/components/auth/OAuthButtons";

export function RemoteAuthLoginModal({
  open,
  onClose,
  onSuccess,
  defaultEmail = "",
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultEmail?: string;
}) {
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiClient.login(email.trim(), password);
      setPassword("");
      onSuccess();
      onClose();
    } catch (err) {
      const msg =
        err instanceof ApiRequestError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Sign in failed";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="remote-auth-login-title"
    >
      <form
        onSubmit={(e) => void onSubmit(e)}
        className="w-full max-w-sm rounded-xl border border-app-border bg-app-card p-5 shadow-xl"
      >
        <h2 id="remote-auth-login-title" className="text-base font-semibold text-app-fg">
          Sign in to Paytm Craft
        </h2>
        <p className="mt-1 text-ui text-app-muted">
          Uses your <code className="text-ui">craft-api</code> account (session cookie).
        </p>

        <div className="mt-4">
          <OAuthButtons nextPath="/" />
        </div>

        <label className="mt-4 block text-ui font-medium text-app-fg">
          Email
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 h-9 w-full rounded-lg border border-app-border bg-app-raised px-3 text-ui-sm text-app-fg outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/30"
          />
        </label>

        <label className="mt-3 block text-ui font-medium text-app-fg">
          Password
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="mt-1 h-9 w-full rounded-lg border border-app-border bg-app-raised px-3 text-ui-sm text-app-fg outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/30"
          />
        </label>

        {error ? <p className="mt-3 text-ui text-red-600">{error}</p> : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-app-border px-3 py-1.5 text-ui font-medium text-app-fg hover:bg-app-inset disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-app-fg px-3 py-1.5 text-ui font-semibold text-app-bg hover:bg-app-muted disabled:opacity-50"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </div>

        <p className="mt-4 text-ui text-app-subtle">
          Dev seed: <span className="font-medium">rahul.verma@paytm.com</span> / <span className="font-medium">craft-dev</span>
          {" · "}
          <Link href="/signup" className={authSecondaryLinkClassName}>
            Create account
          </Link>
        </p>
      </form>
    </div>
  );
}
