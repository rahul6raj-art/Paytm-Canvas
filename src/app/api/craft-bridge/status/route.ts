import { NextResponse } from "next/server";
import {
  defaultCraftUrl,
  isBridgeAuthRequired,
  isCraftBridgeEnabled,
  readPendingImport,
} from "@paytm-craft/bridge";
import { craftBridgeGuard } from "@/lib/craftBridge/apiGuard";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const denied = craftBridgeGuard(req);
  if (denied) return denied;

  return NextResponse.json({
    enabled: isCraftBridgeEnabled(),
    authRequired: isBridgeAuthRequired(),
    craftUrl: defaultCraftUrl(),
    pending: readPendingImport() !== null,
  });
}
