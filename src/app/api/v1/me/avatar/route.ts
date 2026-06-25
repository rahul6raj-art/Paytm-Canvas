import { jsonV1Data, jsonV1Error } from "@/lib/apiV1Responses";
import { mockApiStore } from "@/lib/mockApiStore";
import { resolveMockApiSessionUser } from "@/lib/mockApiRequestAuth";
import { mockApiUserDto } from "@/lib/mockApiSession";

export async function POST(request: Request) {
  const user = resolveMockApiSessionUser(request);
  if (!user) {
    return jsonV1Error("UNAUTHORIZED", "Not signed in", 401);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonV1Error("VALIDATION", "Expected multipart form data", 400);
  }

  const file = form.get("file");
  if (!(file instanceof Blob) || file.size === 0) {
    return jsonV1Error("VALIDATION", "Missing file", 400);
  }
  if (!file.type.startsWith("image/")) {
    return jsonV1Error("VALIDATION", "Avatar must be an image", 400);
  }
  if (file.size > 4 * 1024 * 1024) {
    return jsonV1Error("VALIDATION", "Avatar must be 4 MB or smaller", 400);
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const dataUrl = `data:${file.type || "image/jpeg"};base64,${buf.toString("base64")}`;

  try {
    const updated = mockApiStore.uploadUserAvatar(user.id, dataUrl);
    if (!updated) return jsonV1Error("NOT_FOUND", "User not found", 404);
    return jsonV1Data(mockApiUserDto(updated));
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not upload avatar";
    return jsonV1Error("VALIDATION", message, 400);
  }
}
