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
import { readPrefillLoginEmail, writeLastLoginEmail, writeSavedLoginPassword } from "@/lib/authFormDefaults";
import { isPaytmCraftHttpApiMode } from "@/lib/env";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { AuthPasswordInput } from "@/components/auth/AuthPasswordInput";

export function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("next") || "/";
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEmail(readPrefillLoginEmail());
  }, []);

  if (!isPaytmCraftHttpApiMode()) {
    return (
      <AuthFormShell
        title="Sign up unavailable"
        subtitle="Set NEXT_PUBLIC_PAYTM_CRAFT_MODE to api or remote to create an account."
      >
        <Link href="/" className={authSecondaryLinkClassName}>
          Back to dashboard
        </Link>
      </AuthFormShell>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const trimmedEmail = email.trim();
      await apiClient.register(trimmedEmail, displayName.trim(), password);
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
            : "Sign up failed";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFormShell
      title="Create your account"
      footer={
        <>
          Already have an account?{" "}
          <Link href={`/login${redirectTo !== "/" ? `?next=${encodeURIComponent(redirectTo)}` : ""}`} className={authSecondaryLinkClassName}>
            Sign in
          </Link>
        </>
      }
    >
      <OAuthButtons nextPath={redirectTo} />
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
        <label className="block text-ui font-medium text-app-fg">
          Name
          <input
            type="text"
            autoComplete="name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            className={authFieldClassName}
          />
        </label>
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
        <label className="block text-ui font-medium text-app-fg">
          Password
          <AuthPasswordInput
            autoComplete="new-password"
            value={password}
            onChange={setPassword}
          />
        </label>
        {error ? <p className="text-ui text-red-600">{error}</p> : null}
        <button type="submit" disabled={busy} className={authPrimaryButtonClassName}>
          {busy ? "Creating account…" : "Create account"}
        </button>
      </form>
    </AuthFormShell>
  );
}
