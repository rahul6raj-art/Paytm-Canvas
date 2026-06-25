"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import { AuthPasswordInput } from "@/components/auth/AuthPasswordInput";
import { useCraftAuth } from "@/components/auth/CraftAuthProvider";
import {
  authFieldClassName,
  authPrimaryButtonClassName,
  authSecondaryLinkClassName,
} from "@/components/auth/AuthFormShell";
import { notifyCraftAuthRefresh } from "@/lib/craftAuthSession";
import { apiClient, ApiRequestError } from "@/lib/apiClient";
import { writeSavedLoginPassword } from "@/lib/authFormDefaults";
import { isPaytmCraftHttpApiMode } from "@/lib/env";
import {
  profileSettingsHref,
  resolveProfileSettingsCloseTarget,
} from "@/lib/profileSettingsNavigation";

function ProfileDetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-app-border-subtle bg-app-inset/40 px-3 py-2.5">
      <p className="text-ui-sm font-medium text-app-subtle">{label}</p>
      <p className="mt-0.5 truncate text-ui text-app-fg">{value}</p>
    </div>
  );
}

export function ProfileSettingsForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnParam = searchParams.get("return");
  const returnTo = resolveProfileSettingsCloseTarget(returnParam);
  const { user, apiUser, loading, authEnabled, refresh } = useCraftAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && authEnabled && !apiUser) {
      const next = profileSettingsHref(returnParam);
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [loading, authEnabled, apiUser, router, returnParam]);

  useEffect(() => {
    if (apiUser) setDisplayName(apiUser.displayName);
  }, [apiUser]);

  if (!authEnabled) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-app-border bg-app-card p-6">
        <h1 className="text-lg font-semibold text-app-fg">Profile settings</h1>
        <p className="mt-2 text-ui text-app-muted">
          Accounts are only available in API or remote mode. Switch{" "}
          <code className="text-ui">NEXT_PUBLIC_PAYTM_CRAFT_MODE</code> to enable sign-in.
        </p>
        <Link href="/" className={`${authSecondaryLinkClassName} mt-4 inline-block`}>
          Back to dashboard
        </Link>
      </div>
    );
  }

  if (loading || !user || !apiUser) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-app-border bg-app-card p-6">
        <p className="text-ui text-app-muted">Loading profile…</p>
      </div>
    );
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileBusy(true);
    setError(null);
    setMessage(null);
    try {
      await apiClient.updateProfile({ displayName: displayName.trim() });
      await refresh();
      notifyCraftAuthRefresh();
      setMessage("Profile updated.");
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Could not save profile.");
    } finally {
      setProfileBusy(false);
    }
  }

  async function onAvatarPick(file: File | null) {
    if (!file) return;
    setAvatarBusy(true);
    setError(null);
    setMessage(null);
    try {
      await apiClient.uploadAvatar(file);
      await refresh();
      notifyCraftAuthRefresh();
      setMessage("Profile photo updated.");
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Could not upload profile photo.");
    } finally {
      setAvatarBusy(false);
    }
  }

  async function removeAvatar() {
    setAvatarBusy(true);
    setError(null);
    setMessage(null);
    try {
      await apiClient.updateProfile({ removeAvatar: true });
      await refresh();
      notifyCraftAuthRefresh();
      setMessage("Profile photo removed.");
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Could not remove profile photo.");
    } finally {
      setAvatarBusy(false);
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordBusy(true);
    setError(null);
    setMessage(null);
    try {
      await apiClient.changePassword(currentPassword, newPassword);
      if (apiUser) writeSavedLoginPassword(apiUser.email, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setMessage("Password updated.");
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Could not change password.");
    } finally {
      setPasswordBusy(false);
    }
  }

  function closeProfileSettings() {
    if (returnTo) {
      router.push(returnTo);
      return;
    }
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/");
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4">
      <div className="rounded-xl border border-app-border bg-app-card p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-app-fg">Profile &amp; settings</h1>
          </div>
          <button
            type="button"
            onClick={closeProfileSettings}
            aria-label="Close profile settings"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-app-muted transition-colors hover:bg-app-inset hover:text-app-fg"
          >
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start">
          <button
            type="button"
            disabled={avatarBusy}
            onClick={() => fileRef.current?.click()}
            className="group relative shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            aria-label="Change profile photo"
          >
            <UserAvatar
              name={user.name}
              initials={user.initials}
              avatarUrl={user.avatarUrl}
              avatarHue={user.avatarHue}
              size="lg"
              className="h-20 w-20 text-xl"
            />
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/45 text-ui-sm font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              {avatarBusy ? "…" : "Change"}
            </span>
          </button>

          <div className="min-w-0 flex-1 space-y-3">
            <ProfileDetailRow label="Name" value={user.name} />
            <ProfileDetailRow label="Email" value={apiUser.email} />
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                disabled={avatarBusy}
                onClick={() => fileRef.current?.click()}
                className="rounded-lg border border-app-border px-3 py-1.5 text-ui font-medium text-app-fg hover:bg-app-inset disabled:opacity-50"
              >
                {avatarBusy ? "Uploading…" : "Upload photo"}
              </button>
              {user.avatarUrl ? (
                <button
                  type="button"
                  disabled={avatarBusy}
                  onClick={() => void removeAvatar()}
                  className="rounded-lg border border-app-border px-3 py-1.5 text-ui font-medium text-app-muted hover:bg-app-inset disabled:opacity-50"
                >
                  Remove photo
                </button>
              ) : null}
            </div>
            <p className="text-ui-sm text-app-subtle">PNG, JPG, or GIF · up to 4 MB</p>
          </div>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            e.target.value = "";
            void onAvatarPick(f);
          }}
        />
      </div>

      <div className="rounded-xl border border-app-border bg-app-card p-6">
        <h2 className="text-base font-semibold text-app-fg">Edit profile</h2>
        <p className="mt-1 text-ui text-app-muted">Update how your name appears in Paytm Craft.</p>
        <form onSubmit={(e) => void saveProfile(e)} className="mt-4 space-y-4">
          <label className="block text-ui font-medium text-app-fg">
            Display name
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              className={authFieldClassName}
            />
          </label>
          <button type="submit" disabled={profileBusy} className={authPrimaryButtonClassName}>
            {profileBusy ? "Saving…" : "Save changes"}
          </button>
        </form>
      </div>

      <div className="rounded-xl border border-app-border bg-app-card p-6">
        <h2 className="text-base font-semibold text-app-fg">Password</h2>
        <p className="mt-1 text-ui text-app-muted">Change the password you use to sign in.</p>
        <form onSubmit={(e) => void savePassword(e)} className="mt-4 space-y-4">
          <label className="block text-ui font-medium text-app-fg">
            Current password
            <AuthPasswordInput
              autoComplete="current-password"
              value={currentPassword}
              onChange={setCurrentPassword}
            />
          </label>
          <label className="block text-ui font-medium text-app-fg">
            New password
            <AuthPasswordInput
              autoComplete="new-password"
              value={newPassword}
              onChange={setNewPassword}
            />
          </label>
          <button type="submit" disabled={passwordBusy} className={authPrimaryButtonClassName}>
            {passwordBusy ? "Updating…" : "Update password"}
          </button>
        </form>
      </div>

      {message ? <p className="text-ui text-green-700">{message}</p> : null}
      {error ? <p className="text-ui text-red-600">{error}</p> : null}
    </div>
  );
}
