/** Strip meta words and title-case a product/screen name from user prompts. */
export function cleanProductName(raw: string): string {
  return raw
    .replace(/\b(do|the|a|an|deep|research|full|modern|beautiful|mobile|app|screen|page|ui|ux|please)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((w) => w.length > 0)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** e.g. "Create the Activity Tracking mobile app" → "Activity Tracking" */
export function extractProductNameFromPrompt(prompt: string): string | null {
  const patterns = [
    /(?:create|design|build|make|generate)\s+(?:the\s+|a\s+|an\s+)?(.+?)\s+mobile\s+app\b/i,
    /(?:create|design|build|make|generate)\s+(?:the\s+|a\s+|an\s+)?(.+?)\s+(?:mobile\s+)?(?:app\s+)?screen\b/i,
    /(?:create|design|build|make)\s+(?:the\s+|a\s+)?(.+?)\s+(?:tracking|dashboard|home)\b/i,
  ];
  for (const pattern of patterns) {
    const match = prompt.match(pattern);
    if (!match?.[1]) continue;
    const cleaned = cleanProductName(match[1]);
    if (cleaned.length >= 3 && cleaned.length <= 42) return cleaned;
  }
  return null;
}

export function isActivityTrackingPrompt(prompt: string): boolean {
  return /(activity\s*track|activity\s*tracking|fitness\s*track|workout\s*track|step\s*count|health\s*track|run\s*track|exercise\s*log|calorie\s*track|daily\s*activity)/i.test(
    prompt,
  );
}

export function extractGenericScreenSummary(prompt: string, title: string): string {
  if (isActivityTrackingPrompt(prompt)) {
    return "Track steps, workouts, and daily goals in one place.";
  }
  if (/payment|wallet|upi|bank/i.test(prompt)) {
    return "Send money, pay bills, and manage balances securely.";
  }
  if (/food|delivery|order/i.test(prompt)) {
    return "Browse restaurants, place orders, and track deliveries.";
  }
  if (/social|chat|message/i.test(prompt)) {
    return "Connect with friends and share moments instantly.";
  }
  return `Everything you need for ${title.toLowerCase()} — tailored for mobile.`;
}
