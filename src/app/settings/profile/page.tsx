import { Suspense } from "react";
import { ProfileSettingsForm } from "@/components/settings/ProfileSettingsForm";
import { RequireCraftAuth } from "@/components/auth/RequireCraftAuth";

export default function ProfileSettingsPage() {
  return (
    <RequireCraftAuth>
      <div className="min-h-dvh bg-[hsl(var(--pc-canvas-workspace))] px-4 py-10">
        <Suspense fallback={null}>
          <ProfileSettingsForm />
        </Suspense>
      </div>
    </RequireCraftAuth>
  );
}
