import { jsonV1Data, jsonV1Error } from "@/lib/apiV1Responses";
import { mockApiStore } from "@/lib/mockApiStore";

export async function GET(_req: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  if (!workspaceId || !mockApiStore.workspaceExists(workspaceId)) {
    return jsonV1Error("NOT_FOUND", "Workspace not found", 404);
  }
  return jsonV1Data(mockApiStore.listWorkspaceMembers(workspaceId));
}

export async function POST(req: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  if (!workspaceId || !mockApiStore.workspaceExists(workspaceId)) {
    return jsonV1Error("NOT_FOUND", "Workspace not found", 404);
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonV1Error("BAD_REQUEST", "Invalid JSON body", 400);
  }

  const email = typeof body.email === "string" ? body.email : "";
  const roleRaw = body.role;
  const role =
    roleRaw === "owner" || roleRaw === "admin" || roleRaw === "member" || roleRaw === "guest"
      ? roleRaw
      : roleRaw === "editor"
        ? "member"
        : roleRaw === "viewer"
          ? "guest"
          : undefined;

  const result = mockApiStore.inviteWorkspaceMember(workspaceId, { email, role });
  if ("code" in result) {
    if (result.code === "VALIDATION") {
      return jsonV1Error("VALIDATION", "email is required", 400);
    }
    return jsonV1Error("NOT_FOUND", "User not found — register first", 404);
  }
  return jsonV1Data(result, { status: 201 });
}
