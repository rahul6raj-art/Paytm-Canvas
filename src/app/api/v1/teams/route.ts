import { jsonV1Data } from "@/lib/apiV1Responses";
import { mockApiStore } from "@/lib/mockApiStore";

export async function GET() {
  return jsonV1Data(mockApiStore.listTeams());
}
