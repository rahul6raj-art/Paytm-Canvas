import { jsonV1Data, jsonV1Error } from "@/lib/apiV1Responses";
import { parseMockApiTokenExpiresInDays } from "@/lib/mockApiToken";
import { parseMockApiTokenResourceScopes, parseMockApiTokenScope } from "@/lib/mockApiTokenScope";
import { mockApiStore } from "@/lib/mockApiStore";

export async function GET() {
  const rows = mockApiStore.listApiTokens();
  return jsonV1Data(rows);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonV1Error("BAD_REQUEST", "Invalid JSON body", 400);
  }
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  if (!o) return jsonV1Error("VALIDATION", "Body must be a JSON object", 400);

  const name = String(o.name ?? "").trim();
  if (!name) return jsonV1Error("VALIDATION", "name is required", 400);

  const expiresInDays = parseMockApiTokenExpiresInDays(o.expiresInDays);
  if (o.expiresInDays != null && o.expiresInDays !== "" && expiresInDays === undefined) {
    return jsonV1Error("VALIDATION", "expiresInDays must be a positive integer up to 365", 400);
  }

  const scope = parseMockApiTokenScope(o.scope) ?? "write";
  if (o.scope != null && o.scope !== "" && parseMockApiTokenScope(o.scope) == null) {
    return jsonV1Error("VALIDATION", 'scope must be "read" or "write"', 400);
  }

  const resourceScopes = parseMockApiTokenResourceScopes(o.resourceScopes);
  if (o.resourceScopes != null && resourceScopes == null) {
    return jsonV1Error(
      "VALIDATION",
      'resourceScopes must be an array of scopes like "files:read" or "assets:write"',
      400,
    );
  }

  try {
    const created = mockApiStore.createApiToken({
      name,
      scope,
      resourceScopes: resourceScopes ?? [],
      expiresInDays: expiresInDays ?? null,
    });
    return jsonV1Data({ ...created.row, token: created.token }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not create token";
    return jsonV1Error("VALIDATION", message, 400);
  }
}
