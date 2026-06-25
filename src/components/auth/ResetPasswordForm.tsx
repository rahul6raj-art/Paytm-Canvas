"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  AuthFormShell,
  authPrimaryButtonClassName,
  authSecondaryLinkClassName,
} from "@/components/auth/AuthFormShell";
import { AuthPasswordInput } from "@/components/auth/AuthPasswordInput";
import { apiClient, ApiRequestError } from "@/lib/apiClient";
import { writeLastLoginEmail, writeSavedLoginPassword } from "@/lib/authFormDefaults";
import { isPaytmCraftHttpApiMode } from "@/lib/env";

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  if (!token) {
    return (
      <AuthFormShell title="Invalid reset link">
        <p className="text-ui text-app-muted">This password reset link is missing or invalid.</p>
        <Link href="/forgot-password" className={`${authSecondaryLinkClassName} mt-4 inline-block`}>
          Request a new link
        </Link>
      </AuthFormShell>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const user = await apiClient.resetPassword(token, password);
      writeLastLoginEmail(user.email);
      writeSavedLoginPassword(user.email, password);
      router.replace("/login");
      router.refresh();
    } catch (err) {
      const msg =
        err instanceof ApiRequestError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not reset password";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFormShell
      title="Choose a new password"
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
        <label className="block text-ui font-medium text-app-fg">
          New password
          <AuthPasswordInput
            autoComplete="new-password"
            value={password}
            onChange={setPassword}
          />
        </label>
        <label className="block text-ui font-medium text-app-fg">
          Confirm password
          <AuthPasswordInput
            autoComplete="new-password"
            value={confirmPassword}
            onChange={setConfirmPassword}
          />
        </label>
        {error ? <p className="text-ui text-red-600">{error}</p> : null}
        <button type="submit" disabled={busy} className={authPrimaryButtonClassName}>
          {busy ? "Updating…" : "Update password"}
        </button>
      </form>
    </AuthFormShell>
  );
}
