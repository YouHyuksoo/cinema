import { smooth } from './filmDrawing';
import { filmViewportTransform, type FilmViewportInsets } from './filmViewport';
import type { ZoneEnvironmentState } from './zoneEnvironment';

export const ENVIRONMENT_PORTRAIT = { width: 440, height: 1040 };
/** Aspect ratio is independent of devicePixelRatio and browser zoom. */
export const isEnvironmentPortrait = (width: number, height: number) => width / height < .85;

export function environmentViewportTransform(width: number, height: number, insets?: FilmViewportInsets) {
  if (!isEnvironmentPortrait(width, height)) return filmViewportTransform(width, height, insets);
  // Leave room for the existing selection help and bottom menu anchor.
  const availableHeight = Math.max(1, height - (insets?.bottomInset ?? height * .23) - height * .08);
  const scale = Math.max(.001, Math.min(width / ENVIRONMENT_PORTRAIT.width, availableHeight / ENVIRONMENT_PORTRAIT.height));
  return { scale, offsetX: (width - ENVIRONMENT_PORTRAIT.width * scale) / 2, offsetY: height * .02 };
}

/** Reflow only presentation geometry; never mutate source readings or selection timing. */
export function environmentMobileState(state: ZoneEnvironmentState): ZoneEnvironmentState {
  const charts = smooth(21.5, 23, state.elapsed);
  const zones = state.zones.map(item => {
    const row = Math.floor(item.index / 2);
    const tourY = 350 + row * 130, historyY = 140 + row * 180;
    return { ...item, anchor: { ...item.anchor, x: 110 + item.index % 2 * 220,
      y: tourY + (historyY - tourY) * charts, scale: 1 + item.focus * .03 }, tilt: item.tilt * .3 };
  });
  return { ...state, zones, selected: zones.find(item => item.selected)! };
}

export function environmentMobileHistoryLayout(item: ZoneEnvironmentState['zones'][number]) {
  return { x: item.anchor.x - 72, top: item.anchor.y + 80, width: 144, height: 34 };
}
