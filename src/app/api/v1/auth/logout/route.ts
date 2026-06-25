import { jsonV1Data } from "@/lib/apiV1Responses";
import {
  clearMockApiSessionCookie,
  MOCK_API_SESSION_COOKIE,
  parseMockApiCookies,
} from "@/lib/mockApiSession";
import { mockApiStore } from "@/lib/mockApiStore";

export async function POST(request: Request) {
  const cookies = parseMockApiCookies(request.headers.get("cookie"));
  const token = cookies[MOCK_API_SESSION_COOKIE];
  if (token) mockApiStore.revokeSessionToken(token);
  return jsonV1Data(
    { ok: true },
    { headers: { "Set-Cookie": clearMockApiSessionCookie() } },
  );
}
