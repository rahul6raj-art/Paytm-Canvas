import { jsonV1Data } from "@/lib/apiV1Responses";
import { readOAuthProvidersStatus } from "@/lib/oauth";

export async function GET() {
  return jsonV1Data(readOAuthProvidersStatus());
}
