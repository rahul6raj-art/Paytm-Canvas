"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AuthFormShell,
  authFieldClassName,
  authPrimaryButtonClassName,
  authSecondaryLinkClassName,
} from "@/components/auth/AuthFormShell";
import { apiClient, ApiRequestError } from "@/lib/apiClient";
import { readPrefillLoginEmail } from "@/lib/authFormDefaults";
import { isPaytmCraftApiMode, isPaytmCraftHttpApiMode } from "@/lib/env";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState(() => readPrefillLoginEmail());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState<boolean | null>(null);

  if (!isPaytmCraftHttpApiMode()) {
    return (
      <AuthFormShell
        title="Reset unavailable"
        subtitle="Set NEXT_PUBLIC_PAYTM_CRAFT_MODE to api or remote to reset your password."
      >
        <Link href="/login" className={authSecondaryLinkClassName}>
          Back to sign in
        </Link>
      </AuthFormShell>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    setDevResetUrl(null);
    setEmailSent(null);
    try {
      const result = await apiClient.requestPasswordReset(email.trim());
      setMessage(result.message);
      if (result.devResetUrl && isPaytmCraftApiMode()) setDevResetUrl(result.devResetUrl);
      if (typeof result.emailSent === "boolean") setEmailSent(result.emailSent);
    } catch (err) {
      const msg =
        err instanceof ApiRequestError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not request password reset";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFormShell
      title="Forgot password"
      footer={
        <>
          Remember your password?{" "}
          <Link href="/login" className={authSecondaryLinkClassName}>
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
        <p className="text-ui text-app-muted">
          Enter your account email and we&apos;ll send reset instructions.
        </p>
        <label className="block text-ui font-medium text-app-fg">
          Email
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={authFieldClassName}
          />
        </label>
        {message ? <p className="text-ui text-green-700">{message}</p> : null}
        {devResetUrl ? (
          <p className="rounded-lg border border-app-border-subtle bg-app-inset/40 px-3 py-2.5 text-ui text-app-muted">
            Dev mode: no email is sent.{" "}
            <Link href={devResetUrl} className={authSecondaryLinkClassName}>
              Open reset link
            </Link>
          </p>
        ) : emailSent === false ? (
          <p className="rounded-lg border border-app-border-subtle bg-app-inset/40 px-3 py-2.5 text-ui text-app-muted">
            SMTP is not configured on the API — reset email was not sent. Set{" "}
            <code className="text-ui">CRAFT_SMTP_HOST</code> on <code className="text-ui">craft-api</code>.
          </p>
        ) : null}
        {error ? <p className="text-ui text-red-600">{error}</p> : null}
        <button type="submit" disabled={busy} className={authPrimaryButtonClassName}>
          {busy ? "Sending…" : "Send reset link"}
        </button>
      </form>
    </AuthFormShell>
  );
}
