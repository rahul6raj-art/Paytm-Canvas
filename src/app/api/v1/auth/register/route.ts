import { jsonV1Data, jsonV1Error } from "@/lib/apiV1Responses";
import { mockApiStore } from "@/lib/mockApiStore";
import { buildMockApiSessionCookie, mockApiUserDto } from "@/lib/mockApiSession";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonV1Error("VALIDATION", "Invalid JSON body", 400);
  }
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  if (!o) return jsonV1Error("VALIDATION", "Body must be a JSON object", 400);

  const email = String(o.email ?? "").trim();
  const displayName = String(o.displayName ?? "").trim();
  const password = String(o.password ?? "");

  try {
    const { user, token } = mockApiStore.registerUser({ email, displayName, password });
    return jsonV1Data(mockApiUserDto(user), {
      status: 201,
      headers: { "Set-Cookie": buildMockApiSessionCookie(token) },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Registration failed";
    if (message === "Email already registered") {
      return jsonV1Error("CONFLICT", message, 409);
    }
    return jsonV1Error("VALIDATION", message, 400);
  }
}
