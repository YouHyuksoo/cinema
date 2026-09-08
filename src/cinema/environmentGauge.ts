import { smooth } from './filmDrawing';
import { ENVIRONMENT_TIMING, type ZoneEnvironmentState } from './zoneEnvironment';

/** Drawing and sensor tethers share these fixed, unscaled mounting positions. */
export const ENVIRONMENT_GAUGES = {
  temperature: { x: 430, y: 390, radius: 132 },
  humidity: { x: 850, y: 390, radius: 132 },
} as const;

export function environmentGaugeState(state: ZoneEnvironmentState) {
  const { tourStart, tourEnd } = ENVIRONMENT_TIMING;
  const duration = tourEnd - tourStart;
  const position = Math.max(0, Math.min(duration, state.elapsed - tourStart));
  const count = state.zones.length;
  const dwell = count > 0 ? duration / count : duration;
  const completed = Math.floor(position / dwell);
  const local = position - completed * dwell;
  // Advance one detent per selection without resetting the angle at each boundary.
  const detent = completed + smooth(0, dwell * .3, local);
  return {
    assembly: smooth(tourStart, tourStart + .9, state.elapsed),
    opacity: count === 0 ? 0 : smooth(tourStart, tourStart + .2, state.elapsed)
      * (1 - smooth(tourEnd - .65, tourEnd, state.elapsed)),
    readingOpacity: .7 + .3 * state.focus,
    outerRotation: state.elapsed * .28 + detent * .42,
    innerRotation: -state.elapsed * .17 - detent * .12,
  };
}
