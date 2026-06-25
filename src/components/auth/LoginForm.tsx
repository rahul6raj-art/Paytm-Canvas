"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AuthFormShell,
  authFieldClassName,
  authPrimaryButtonClassName,
  authSecondaryLinkClassName,
} from "@/components/auth/AuthFormShell";
import { notifyCraftAuthRefresh } from "@/lib/craftAuthSession";
import { apiClient, ApiRequestError } from "@/lib/apiClient";
import {
  readPrefillLoginEmail,
  readPrefillPassword,
  writeLastLoginEmail,
  writeSavedLoginPassword,
} from "@/lib/authFormDefaults";
import { isPaytmCraftHttpApiMode } from "@/lib/env";
import { OAuthButtons, oauthErrorMessage } from "@/components/auth/OAuthButtons";
import { AuthPasswordInput } from "@/components/auth/AuthPasswordInput";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("next") || "/";
  const oauthError = oauthErrorMessage(searchParams.get("error"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const prefillEmail = readPrefillLoginEmail();
    setEmail(prefillEmail);
    setPassword(readPrefillPassword(prefillEmail));
  }, []);

  if (!isPaytmCraftHttpApiMode()) {
    return (
      <AuthFormShell
        title="Sign in unavailable"
        subtitle="Set NEXT_PUBLIC_PAYTM_CRAFT_MODE to api or remote to use accounts."
      >
        <Link href="/" className={authSecondaryLinkClassName}>
          Back to dashboard
        </Link>
      </AuthFormShell>
    );
  }

  function onEmailBlur() {
    const saved = readPrefillPassword(email.trim());
    if (saved) setPassword(saved);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const trimmedEmail = email.trim();
      await apiClient.login(trimmedEmail, password);
      writeLastLoginEmail(trimmedEmail);
      writeSavedLoginPassword(trimmedEmail, password);
      notifyCraftAuthRefresh();
      router.replace(redirectTo);
      router.refresh();
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

  const forgotPasswordHref =
    redirectTo !== "/"
      ? `/forgot-password?next=${encodeURIComponent(redirectTo)}`
      : "/forgot-password";

  return (
    <AuthFormShell
      title="Sign in"
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link href={`/signup${redirectTo !== "/" ? `?next=${encodeURIComponent(redirectTo)}` : ""}`} className={authSecondaryLinkClassName}>
            Create one
          </Link>
        </>
      }
    >
      <OAuthButtons nextPath={redirectTo} />
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
        <label className="block text-ui font-medium text-app-fg">
          Email
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={onEmailBlur}
            required
            className={authFieldClassName}
          />
        </label>
        <label className="block text-ui font-medium text-app-fg">
          Password
          <AuthPasswordInput
            autoComplete="current-password"
            value={password}
            onChange={setPassword}
            minLength={4}
          />
        </label>
        <div className="text-right">
          <Link href={forgotPasswordHref} className={`${authSecondaryLinkClassName} text-ui-sm`}>
            Forgot password?
          </Link>
        </div>
        {oauthError ? <p className="text-ui text-red-600">{oauthError}</p> : null}
        {error ? <p className="text-ui text-red-600">{error}</p> : null}
        <button type="submit" disabled={busy} className={authPrimaryButtonClassName}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </AuthFormShell>
  );
}
