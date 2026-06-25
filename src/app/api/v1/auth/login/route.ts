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
  const password = String(o.password ?? "");
  if (!email || !password) {
    return jsonV1Error("VALIDATION", "email and password required", 400);
  }

  try {
    const { user, token } = mockApiStore.loginUser({ email, password });
    return jsonV1Data(mockApiUserDto(user), {
      headers: { "Set-Cookie": buildMockApiSessionCookie(token) },
    });
  } catch {
    return jsonV1Error("UNAUTHORIZED", "Invalid email or password", 401);
  }
}
