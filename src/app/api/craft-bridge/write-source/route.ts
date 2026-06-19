import { NextResponse } from "next/server";
import { writeSourceFile } from "@paytm-craft/bridge";
import type { CraftBridgeWriteSourceRequest } from "@/lib/craftBridge/types";
import { craftBridgeGuard } from "@/lib/craftBridge/apiGuard";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const denied = craftBridgeGuard(req);
  if (denied) return denied;

  try {
    const body = (await req.json()) as CraftBridgeWriteSourceRequest;
    if (!body?.repoRoot?.trim() || !body?.sourcePath?.trim()) {
      return NextResponse.json({ error: "repoRoot and sourcePath are required." }, { status: 400 });
    }
    if (typeof body.content !== "string") {
      return NextResponse.json({ error: "content must be a string." }, { status: 400 });
    }

    const result = writeSourceFile(body);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (e) {
    console.error("[craft-bridge/write-source]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Write failed." },
      { status: 500 },
    );
  }
}
