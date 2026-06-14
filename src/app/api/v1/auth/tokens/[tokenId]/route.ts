import { jsonV1Data, jsonV1Error } from "@/lib/apiV1Responses";
import { mockApiStore } from "@/lib/mockApiStore";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ tokenId: string }> },
) {
  const { tokenId } = await context.params;
  const id = String(tokenId ?? "").trim();
  if (!id) return jsonV1Error("VALIDATION", "tokenId required", 400);

  const user = mockApiStore.getCurrentUser();
  const revoked = mockApiStore.revokeApiToken(user.id, id);
  if (!revoked) return jsonV1Error("NOT_FOUND", "Token not found", 404);
  return jsonV1Data({ ok: true });
}
