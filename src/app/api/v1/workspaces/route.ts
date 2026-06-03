import { jsonV1Data } from "@/lib/apiV1Responses";
import { mockApiStore } from "@/lib/mockApiStore";

export async function GET() {
  const list = mockApiStore.listWorkspaces().map((w) => ({
    id: w.id,
    name: w.name,
    slug: w.slug,
  }));
  return jsonV1Data(list);
}
