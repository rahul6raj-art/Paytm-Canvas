import { jsonV1Data } from "@/lib/apiV1Responses";
import { readGoogleOAuthSetupInfo } from "@/lib/oauth";

export async function GET() {
  return jsonV1Data(readGoogleOAuthSetupInfo("api"));
}
