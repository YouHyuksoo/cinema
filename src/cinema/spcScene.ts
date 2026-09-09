import { smooth } from './filmDrawing';
import { mix } from './filmMath';
import { createHoloProjection } from './holoSpace';

export const SPC_FILM_SECONDS = 40;
export interface SpcPanelPose { x: number; y: number; depth: number; yaw: number; pitch: number }

/** The sample matrix and plotted trace share the same last visible subgroup. */
export function spcTraceHead(time: number, count: number, series: 'xbar' | 'r' = 'xbar') {
  const start = series === 'r' ? 2.5 : 2;
  if (!Number.isFinite(time) || time < start || count < 1) return -1;
  return smooth(start, 8, time) * (count - 1);
}

/** The chart surfaces retain their data while the camera changes their position and depth. */
export function spcSceneState(time: number) {
  const t = Number.isFinite(time) ? Math.max(0, Math.min(SPC_FILM_SECONDS, time)) : 0;
  const distributionIn = smooth(12, 16, t);
  const distribution = distributionIn * (1 - smooth(36, 38.5, t));
  const histogramRetreat = smooth(24, 28, t);
  const capability = histogramRetreat * (1 - smooth(34.5, 36, t));
  const reveal = smooth(.15, 1.4, t) * (1 - smooth(38, 40, t));
  const controls: SpcPanelPose = { x: mix(430, 246, distribution), y: mix(354, 382, distribution),
    depth: mix(30, -990, distribution), yaw: mix(.015, -.28, distribution), pitch: .025 + distribution * .045 };
  const histogram: SpcPanelPose = { x: mix(mix(1010, 772, distributionIn), 1030, histogramRetreat),
    y: mix(353, 389, histogramRetreat), depth: mix(mix(-1100, 20, distributionIn), -1050, histogramRetreat)
      - smooth(36, 38.5, t) * 450,
    yaw: mix(.22, .015, distributionIn) + histogramRetreat * .22, pitch: .07 };
  return { time: t, distribution, capability, reveal, controls, histogram,
    core: { x: 630, y: 344, scale: .56 + capability * .3 },
    controlReveal: smooth(1.4, 7, t),
    controlFocus: smooth(7, 9.5, t) * (1 - smooth(12, 14, t)),
    controlsOpacity: reveal * (1 - distribution * .58),
    histogramReveal: smooth(12.5, 17, t),
    histogramOpacity: reveal * smooth(12, 14, t) * (1 - histogramRetreat * .48) * (1 - smooth(36, 38.5, t)),
    coreOpacity: reveal * smooth(26.4, 28, t) * (1 - smooth(34.5, 36, t)),
    phase: t < 14 ? 'control' as const : t < 26 ? 'distribution' as const : t < 36 ? 'capability' as const : 'return' as const };
}

/** Project surface points around their own centre; forward/backward depth controls apparent size. */
export function spcPanelProjection(pose: SpcPanelPose) {
  const view = createHoloProjection({ x: 0, y: 0, yaw: pose.yaw, pitch: pose.pitch, distance: 1000 });
  const center = view({ x: 0, y: 0, z: -pose.depth });
  return (x: number, y: number) => {
    const point = view({ x, y, z: -pose.depth });
    return { x: pose.x + point.x - center.x, y: pose.y + point.y - center.y };
  };
}
