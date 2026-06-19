import { NextResponse } from "next/server";
import { clearPendingImport, readPendingImport } from "@paytm-craft/bridge";
import { craftBridgeGuard } from "@/lib/craftBridge/apiGuard";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const denied = craftBridgeGuard(req);
  if (denied) return denied;

  const pending = readPendingImport();
  if (!pending) {
    return NextResponse.json({ pending: null });
  }

  return NextResponse.json({ pending });
}

export async function DELETE(req: Request) {
  const denied = craftBridgeGuard(req);
  if (denied) return denied;

  clearPendingImport();
  return NextResponse.json({ ok: true });
}
