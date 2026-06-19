import { NextResponse } from "next/server";
import { readSourceFile } from "@paytm-craft/bridge";
import { craftBridgeGuard } from "@/lib/craftBridge/apiGuard";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const denied = craftBridgeGuard(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const repoRoot = url.searchParams.get("repoRoot")?.trim();
  const sourcePath = url.searchParams.get("sourcePath")?.trim();

  if (!repoRoot || !sourcePath) {
    return NextResponse.json({ error: "repoRoot and sourcePath are required." }, { status: 400 });
  }

  const result = readSourceFile(repoRoot, sourcePath);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return NextResponse.json(result);
}
