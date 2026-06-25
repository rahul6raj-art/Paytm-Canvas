"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { PaytmCraftLogo } from "@/components/PaytmCraftLogo";

export function AuthFormShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[hsl(var(--pc-canvas-workspace))] px-4 py-10">
      <div className="w-full max-w-md rounded-xl border border-app-border bg-app-card p-6 shadow-xl">
        <div className="mb-6 text-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-4 text-3xl font-bold tracking-tight text-app-fg"
          >
            <PaytmCraftLogo className="size-9 shrink-0" />
            <span>Paytm Craft</span>
          </Link>
          <h1 className="mt-4 text-lg font-semibold text-app-fg">{title}</h1>
          {subtitle ? <p className="mt-1 text-ui text-app-muted">{subtitle}</p> : null}
        </div>
        {children}
        {footer ? <div className="mt-6 border-t border-app-border-subtle pt-4 text-center text-ui text-app-muted">{footer}</div> : null}
      </div>
    </div>
  );
}

export const authFieldClassName =
  "mt-1 h-10 w-full rounded-lg border border-app-border bg-app-raised px-3 text-ui-sm text-app-fg outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/30";

export const authPrimaryButtonClassName =
  "inline-flex h-10 w-full items-center justify-center rounded-lg bg-app-fg px-4 text-ui font-semibold text-app-bg transition-opacity hover:opacity-90 disabled:opacity-50";

export const authSecondaryLinkClassName = "font-medium text-app-fg underline-offset-2 hover:underline";
