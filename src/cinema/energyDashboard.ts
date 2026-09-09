import { ENERGY_CORE_SECONDS, ENERGY_LAYERS, energyRatio, type EnergyCoreData, type EnergyReading } from './energyCore';
import { smooth } from './filmDrawing';
import { clamp01, mix } from './filmMath';

/**
 * Energy scene as a two-act dashboard. Act one is a cyan HUD (glass panels around a segmented
 * reactor ring over a holographic pedestal); act two is a violet infographic (wedge ring, dot matrix,
 * check grid, wave and mountain charts). Both acts read the same EnergyCoreData; the ring stays put
 * and morphs while the panels swap, so the cut never loses the operator's place.
 */
export const ENERGY_BOARD_SWITCH = 15;
export const ENERGY_BOARD_BLEND_SECONDS = 2.4;
export const ENERGY_CHANNEL_SECONDS = 4;
export type EnergyBoard = 'hud' | 'infographic';

export interface EnergyBoardState {
  elapsed: number;
  /** Scene-wide fade in and out. */
  opacity: number;
  /** Act-one panels flying into place (0 → 1) during the first seconds. */
  assembly: number;
  /** 0 = pure HUD act, 1 = pure infographic act; eased across the switch window. */
  blend: number;
  board: EnergyBoard;
  /** Channel in focus: cycles power → output → efficiency every ENERGY_CHANNEL_SECONDS. */
  activeIndex: number;
  /** Progress within the current channel window (0 → 1). */
  channelProgress: number;
  /** Second act panels settling into place (0 → 1). */
  settle: number;
}

export function energyBoardState(time: number): EnergyBoardState {
  const elapsed = Number.isFinite(time) ? Math.max(0, Math.min(ENERGY_CORE_SECONDS, time)) : 0;
  const release = 1 - smooth(ENERGY_CORE_SECONDS - 2, ENERGY_CORE_SECONDS, elapsed);
  const blend = smooth(ENERGY_BOARD_SWITCH, ENERGY_BOARD_SWITCH + ENERGY_BOARD_BLEND_SECONDS, elapsed);
  const activeIndex = Math.floor(Math.max(0, elapsed - 2) / ENERGY_CHANNEL_SECONDS) % ENERGY_LAYERS.length;
  const channelProgress = clamp01((Math.max(0, elapsed - 2) % ENERGY_CHANNEL_SECONDS) / ENERGY_CHANNEL_SECONDS);
  return {
    elapsed, opacity: smooth(0, 1, elapsed) * release, assembly: smooth(.3, 2.6, elapsed), blend,
    board: blend < .5 ? 'hud' : 'infographic', activeIndex, channelProgress,
    settle: smooth(ENERGY_BOARD_SWITCH + .6, ENERGY_BOARD_SWITCH + ENERGY_BOARD_BLEND_SECONDS + 1.2, elapsed),
  };
}

/** Per-channel accent colours for each act (power, output, efficiency). */
export const ENERGY_PALETTE: Record<EnergyBoard, { channels: readonly [string, string, string]; ink: string; dim: string; panel: string; line: string; background: string }> = {
  hud: { channels: ['#ff5fa2', '#5fe3ff', '#3dff9a'], ink: '#d7f3ff', dim: '#6f9db3', panel: 'rgba(12,44,78,.55)', line: '#5fe3ff', background: '#061a3a' },
  infographic: { channels: ['#ff8a3d', '#ff4fd8', '#8f7bff'], ink: '#f2e9ff', dim: '#9b86d6', panel: 'rgba(58,20,120,.55)', line: '#ff4fd8', background: '#2b0f6b' },
};

export interface PanelRect { x: number; y: number; width: number; height: number }
/** Content region is 72..1208 × 60..650 (the dock progress bar sits at 662). */
export const HUD_PANELS: Record<'topLeft' | 'bottomLeft' | 'topRight' | 'bottomRight', PanelRect> = {
  topLeft: { x: 72, y: 96, width: 296, height: 208 },
  bottomLeft: { x: 72, y: 322, width: 296, height: 208 },
  topRight: { x: 912, y: 96, width: 296, height: 208 },
  bottomRight: { x: 912, y: 322, width: 296, height: 208 },
};
export const INFO_PANELS: Record<'lead' | 'text' | 'rings' | 'matrix' | 'checks' | 'mountain', PanelRect> = {
  lead: { x: 72, y: 82, width: 300, height: 120 },
  text: { x: 72, y: 218, width: 300, height: 218 },
  rings: { x: 72, y: 452, width: 300, height: 176 },
  matrix: { x: 912, y: 82, width: 296, height: 210 },
  checks: { x: 912, y: 308, width: 296, height: 130 },
  mountain: { x: 912, y: 454, width: 296, height: 176 },
};
export const RING_CENTER = { x: 640, y: 352 };
export const RING_RADIUS = 150;

/** Deterministic pseudo-history around a reading's ratio, for the bar/area and mountain charts (demo data). */
export function energyHistory(reading: EnergyReading, count: number, seed = 0): number[] {
  const ratio = energyRatio(reading);
  const points: number[] = [];
  for (let index = 0; index < count; index++) {
    const t = count > 1 ? index / (count - 1) : 0;
    const wobble = Math.sin(t * Math.PI * 2.6 + seed * 1.7) * .16 + Math.sin(t * Math.PI * 7.1 + seed * .9) * .06;
    points.push(clamp01(ratio * (.72 + .28 * t) + wobble * ratio));
  }
  return points;
}

/** Speedometer needle angle (radians) for a ratio: a 240° sweep from lower-left to lower-right. */
export function gaugeAngle(ratio: number) {
  return mix(Math.PI * .75, Math.PI * 2.25, clamp01(ratio));
}

/** Number of lit segments out of `count` for a ratio. */
export const litSegments = (count: number, ratio: number) => Math.round(clamp01(ratio) * count);

/** Dot-matrix levels (0..1) for rows × cols: columns fill from the bottom by the ratio, brighter to the right. */
export function dotMatrix(rows: number, columns: number, ratio: number, seed = 0): number[][] {
  const grid: number[][] = [];
  for (let row = 0; row < rows; row++) {
    const line: number[] = [];
    for (let column = 0; column < columns; column++) {
      const height = clamp01(ratio * (.65 + .35 * Math.abs(Math.sin(column * 1.3 + seed))));
      const filled = (rows - row) / rows <= height;
      line.push(filled ? .55 + .45 * (column / Math.max(1, columns - 1)) : 0);
    }
    grid.push(line);
  }
  return grid;
}

/** Check grid: each channel passes when it reaches 80% of its capacity (two rows of three). */
export function checkGrid(data: EnergyCoreData): { key: string; ok: boolean }[] {
  return ENERGY_LAYERS.flatMap(layer => {
    const ratio = energyRatio(data[layer.key]);
    return [{ key: `${layer.key}-level`, ok: ratio >= .8 }, { key: `${layer.key}-trend`, ok: ratio >= .5 }];
  });
}

/** Seven-segment encoding: bit order a b c d e f g (top, top-right, bottom-right, bottom, bottom-left, top-left, middle). */
const SEGMENTS: Record<string, number> = {
  '0': 0b1111110, '1': 0b0110000, '2': 0b1101101, '3': 0b1111001, '4': 0b0110011, '5': 0b1011011,
  '6': 0b1011111, '7': 0b1110000, '8': 0b1111111, '9': 0b1111011, '-': 0b0000001, ' ': 0,
};
export const sevenSegment = (character: string) => SEGMENTS[character] ?? 0;
