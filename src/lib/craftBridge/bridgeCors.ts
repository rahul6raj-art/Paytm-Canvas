const LOCAL_DEV_ORIGIN =
  /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i;

/** Allow live Vite preview origins to call craft-bridge APIs from the browser. */
export function bridgeCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin")?.trim();
  if (!origin || !LOCAL_DEV_ORIGIN.test(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Craft-Bridge-Token",
    Vary: "Origin",
  };
}

export function jsonWithBridgeCors(
  req: Request,
  body: unknown,
  init?: { status?: number },
): Response {
  return Response.json(body, {
    status: init?.status,
    headers: bridgeCorsHeaders(req),
  });
}
