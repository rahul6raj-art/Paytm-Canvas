"use client";

import { useEffect, useState } from "react";
import type { GoogleOAuthSetupInfo } from "@/lib/oauth";
import { isPaytmCraftHttpApiMode } from "@/lib/env";

export function GoogleOAuthSetupHint() {
  const [info, setInfo] = useState<GoogleOAuthSetupInfo | null>(null);

  useEffect(() => {
    if (!isPaytmCraftHttpApiMode()) return;
    void fetch("/api/v1/auth/oauth/setup-info")
      .then((res) => res.json())
      .then((body: { data?: GoogleOAuthSetupInfo }) => setInfo(body.data ?? null))
      .catch(() => setInfo(null));
  }, []);

  if (!info || info.configured) return null;

  return (
    <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-left text-ui-sm text-app-fg">
      <p className="font-medium text-app-fg">Google sign-in needs one-time setup</p>
      <p className="mt-1 text-app-muted">
        Run{" "}
        <code className="rounded bg-app-inset px-1 py-0.5 text-ui-sm">npm run setup:google-oauth</code>{" "}
        and paste your Google OAuth client credentials. Redirect URI:
      </p>
      <code className="mt-2 block break-all rounded bg-app-inset px-2 py-1 text-ui-sm">{info.callbackUrl}</code>
    </div>
  );
}
