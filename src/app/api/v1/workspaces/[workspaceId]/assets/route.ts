import { jsonV1Data, jsonV1Error } from "@/lib/apiV1Responses";

export async function POST(req: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  if (!workspaceId) {
    return jsonV1Error("BAD_REQUEST", "workspaceId required", 400);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonV1Error("BAD_REQUEST", "Expected multipart form data", 400);
  }

  const file = form.get("file");
  if (!(file instanceof Blob) || file.size === 0) {
    return jsonV1Error("BAD_REQUEST", "Missing file", 400);
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const base64 = buf.toString("base64");
  const mime = file.type || "application/octet-stream";
  const dataUrl = `data:${mime};base64,${base64}`;
  const assetId = `api-asset-${workspaceId.slice(0, 6)}-${Date.now()}`;

  return jsonV1Data({ assetId, url: dataUrl });
}
