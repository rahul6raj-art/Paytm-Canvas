/**
 * PML Neon phone column — must match linked repo `--phone-column-width` (376px).
 * Craft bridge capture viewport and artboard sizing use these values for 1:1 mapping.
 */
export const PML_PHONE_COLUMN_WIDTH = 376;
export const PML_PHONE_VIEWPORT_HEIGHT = 844;

export const PML_PHONE_VIEWPORT = {
  width: PML_PHONE_COLUMN_WIDTH,
  height: PML_PHONE_VIEWPORT_HEIGHT,
} as const;

/** @deprecated Use PML_PHONE_COLUMN_WIDTH — kept for imports that used IMPORT_SCREEN_WIDTH. */
export const IMPORT_SCREEN_WIDTH = PML_PHONE_COLUMN_WIDTH;
