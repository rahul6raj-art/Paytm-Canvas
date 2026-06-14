import { jsonV1Data, jsonV1Error } from "@/lib/apiV1Responses";
import { mockApiStore } from "@/lib/mockApiStore";

export async function GET(_req: Request, { params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  if (!teamId || !mockApiStore.listTeams().some((t) => t.id === teamId)) {
    return jsonV1Error("NOT_FOUND", "Team not found", 404);
  }
  return jsonV1Data(mockApiStore.listTeamMembers(teamId));
}
