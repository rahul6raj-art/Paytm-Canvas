"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useCraftAuth } from "@/components/auth/CraftAuthProvider";
import { craftLoginUrl } from "@/lib/craftAuthSession";

export function RequireCraftAuth({ children }: { children: ReactNode }) {
  const { authEnabled, loading, user } = useCraftAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!authEnabled || loading || user) return;
    router.replace(craftLoginUrl(pathname));
  }, [authEnabled, loading, user, router, pathname]);

  if (!authEnabled) return children;
  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[hsl(var(--pc-canvas-workspace))] text-ui text-app-muted">
        Loading…
      </div>
    );
  }
  if (!user) return null;
  return children;
}
