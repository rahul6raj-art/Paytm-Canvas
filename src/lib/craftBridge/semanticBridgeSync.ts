import { CODE_PAYLOAD_START } from "@/lib/codeRoundTrip/types";
import type { CodeRoundTripLink } from "@/lib/craftBridge/types";

/** Live preview links should patch the real screen file, not replace it with Craft export output. */
export function shouldUseSemanticBridgeSync(
  link: CodeRoundTripLink,
  sourceContent: string,
): boolean {
  if (!link.previewUrl?.trim()) return false;
  return !sourceContent.includes(CODE_PAYLOAD_START);
}
