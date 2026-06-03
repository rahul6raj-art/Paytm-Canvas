import { jsonV1Data } from "@/lib/apiV1Responses";
import { mockApiStore } from "@/lib/mockApiStore";

export async function GET() {
  const u = mockApiStore.getCurrentUser();
  return jsonV1Data({
    id: u.id,
    email: u.email,
    displayName: u.displayName,
  });
}
