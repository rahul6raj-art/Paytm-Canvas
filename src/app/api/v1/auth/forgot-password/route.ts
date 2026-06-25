import { jsonV1Data, jsonV1Error } from "@/lib/apiV1Responses";
import { mockApiStore } from "@/lib/mockApiStore";
import { craftAppUrl } from "@/lib/oauth/config";

const RESET_MESSAGE =
  "If an account exists for that email, we sent password reset instructions.";

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
  if (!email) {
    return jsonV1Error("VALIDATION", "email required", 400);
  }

  const reset = mockApiStore.requestPasswordReset(email);
  const data: { message: string; devResetUrl?: string; emailSent: boolean } = {
    message: RESET_MESSAGE,
    emailSent: false,
  };
  if (reset) {
    const base = craftAppUrl().replace(/\/$/, "");
    data.devResetUrl = `${base}/reset-password?token=${encodeURIComponent(reset.token)}`;
  }

  return jsonV1Data(data);
}
