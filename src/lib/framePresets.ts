export type FramePresetCategory = "phone" | "tablet" | "desktop";

export type FramePreset = {
  id: string;
  label: string;
  category: FramePresetCategory;
  width: number;
  height: number;
};

export const FRAME_PRESET_CATEGORIES: { id: FramePresetCategory; label: string }[] = [
  { id: "phone", label: "Phone" },
  { id: "tablet", label: "Tablet" },
  { id: "desktop", label: "Desktop / Web" },
];

export const FRAME_PRESETS: FramePreset[] = [
  { id: "iphone-15-pro", label: "iPhone 15 Pro", category: "phone", width: 393, height: 852 },
  { id: "iphone-14", label: "iPhone 14", category: "phone", width: 390, height: 844 },
  { id: "iphone-se", label: "iPhone SE", category: "phone", width: 375, height: 667 },
  { id: "android-medium", label: "Android Medium", category: "phone", width: 412, height: 915 },
  { id: "pixel-7", label: "Pixel 7", category: "phone", width: 412, height: 892 },
  { id: "ipad-mini", label: "iPad Mini", category: "tablet", width: 744, height: 1133 },
  { id: "ipad-air", label: "iPad Air", category: "tablet", width: 820, height: 1180 },
  { id: "ipad-pro-11", label: 'iPad Pro 11"', category: "tablet", width: 834, height: 1194 },
  { id: "ipad-pro-12", label: 'iPad Pro 12.9"', category: "tablet", width: 1024, height: 1366 },
  { id: "desktop", label: "Desktop", category: "desktop", width: 1440, height: 900 },
  { id: "desktop-hd", label: "Desktop HD", category: "desktop", width: 1920, height: 1080 },
  { id: "macbook-14", label: 'MacBook 14"', category: "desktop", width: 1512, height: 982 },
  { id: "web-1280", label: "Web 1280", category: "desktop", width: 1280, height: 800 },
];

export const DEFAULT_FRAME_PRESET_ID = "iphone-14";

export const FRAME_CUSTOM_PRESET_ID = "custom";

/** Default size when clicking canvas with custom / draw mode (no drag). */
export const FRAME_CUSTOM_CLICK_SIZE = { width: 400, height: 300 };

export function getFramePreset(id: string): FramePreset | null {
  return FRAME_PRESETS.find((p) => p.id === id) ?? null;
}

export function resolveFramePresetSize(presetId: string): { width: number; height: number; label: string } {
  if (presetId === FRAME_CUSTOM_PRESET_ID) {
    return {
      width: FRAME_CUSTOM_CLICK_SIZE.width,
      height: FRAME_CUSTOM_CLICK_SIZE.height,
      label: "Frame",
    };
  }
  const preset = getFramePreset(presetId);
  if (preset) {
    return { width: preset.width, height: preset.height, label: preset.label };
  }
  const fallback = getFramePreset(DEFAULT_FRAME_PRESET_ID)!;
  return { width: fallback.width, height: fallback.height, label: fallback.label };
}

/** Subset for responsive preview panel chips. */
export const RESPONSIVE_DEVICE_PRESETS = FRAME_PRESETS.filter((p) =>
  ["iphone-14", "android-medium", "ipad-pro-11", "desktop"].includes(p.id),
);
