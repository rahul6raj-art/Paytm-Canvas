import { craftAppUrl, isGoogleOAuthConfigured, oauthCallbackUrl } from "./config";
import { isGoogleOAuthDevMockEnabled } from "./devMockGoogle";

export type GoogleOAuthSetupInfo = {
  configured: boolean;
  devMockEnabled: boolean;
  callbackUrl: string;
  authorizedOrigin: string;
  appUrl: string;
};

export function readGoogleOAuthSetupInfo(mode: "api" | "remote"): GoogleOAuthSetupInfo {
  const appUrl = craftAppUrl().replace(/\/$/, "");
  return {
    configured: isGoogleOAuthConfigured(),
    devMockEnabled: isGoogleOAuthDevMockEnabled(),
    callbackUrl: oauthCallbackUrl("google", mode),
    authorizedOrigin: appUrl,
    appUrl,
  };
}
