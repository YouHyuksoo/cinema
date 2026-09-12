/** Shared by the settings selector and voice/text command validation. */
export const PLAYBACK_RATE_OPTIONS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4]
  .map(rate => ({ value: String(rate), label: `${rate}×${rate === 1 ? ' (기본)' : ''}` }));
