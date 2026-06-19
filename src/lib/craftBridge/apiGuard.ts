import { NextResponse } from "next/server";
import { assertBridgeAccess } from "@paytm-craft/bridge";

export function craftBridgeGuard(req: Request): NextResponse | null {
  const guard = assertBridgeAccess(req);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  return null;
}
