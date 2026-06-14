/** Latest completed integration track number (Tracks 2–N). Track 1 is native renderer. */
export const LATEST_INTEGRATION_TRACK = 36;

export function integrationTrackRangeLabel(): string {
  return `Tracks 2–${LATEST_INTEGRATION_TRACK}`;
}

export function integrationTrackRangePattern(): RegExp {
  return new RegExp(`Tracks 2–${LATEST_INTEGRATION_TRACK}`);
}
