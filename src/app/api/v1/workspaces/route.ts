import { jsonV1Data } from "@/lib/apiV1Responses";
import { mockApiTokenGuard } from "@/lib/mockApiRequestAuth";
import { mockApiStore } from "@/lib/mockApiStore";

export async function GET(request: Request) {
  const denied = mockApiTokenGuard(request, "GET", {
    read: "workspaces:read",
    write: "workspaces:read",
  });
  if (denied) return denied;
  const list = mockApiStore.listWorkspaces().map((w) => ({
    id: w.id,
    teamId: w.teamId,
    name: w.name,
    slug: w.slug,
  }));
  return jsonV1Data(list);
}
