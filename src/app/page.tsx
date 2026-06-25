import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { RequireCraftAuth } from "@/components/auth/RequireCraftAuth";

export default function Home() {
  return (
    <RequireCraftAuth>
      <DashboardShell />
    </RequireCraftAuth>
  );
}
