import { smooth } from './filmDrawing';

export const CORNER_FILM_SECONDS = 40;
export const CORNER_FINALE_START = 29.2;
export const CORNER_CARD_SIZE = { width: 340, height: 210 } as const;
export const CORNER_PRODUCTION = { target: 1450, actual: 1267, remaining: 1450 - 1267, achievement: 1267 / 1450 * 100 } as const;
export type CornerKind = 'production' | 'quality' | 'equipment' | 'cycle';
export interface CornerItem {
  id: string;
  label: string;
  value: string;
  unit: string;
  detail: string;
  heat: number;
  kind: CornerKind;
  corner: { x: number; y: number };
}

export const CORNER_ITEMS = [
  { id: 'production', label: '생산 달성', value: CORNER_PRODUCTION.achievement.toFixed(1), unit: '%',
    detail: `계획 ${CORNER_PRODUCTION.target.toLocaleString('en-US')} EA · 실적 ${CORNER_PRODUCTION.actual.toLocaleString('en-US')} EA`, heat: .28,
    kind: 'production', corner: { x: 1030, y: 183 } },
  { id: 'quality', label: '양품률', value: '98.6', unit: '%', detail: '검사 1,280 EA · 양품 1,262 EA', heat: .1,
    kind: 'quality', corner: { x: 1030, y: 527 } },
  { id: 'equipment', label: '설비 가동', value: '11/12', unit: '대', detail: '12대 중 11대 가동 · 1대 점검', heat: .25,
    kind: 'equipment', corner: { x: 250, y: 183 } },
  { id: 'cycle', label: '사이클 타임', value: '7.1', unit: 's', detail: '기준 7.5 s · 현재 7.1 s', heat: 0,
    kind: 'cycle', corner: { x: 250, y: 527 } },
] as const satisfies readonly CornerItem[];

export interface CornerItemState {
  item: CornerItem;
  index: number;
  x: number;
  y: number;
  scale: number;
  opacity: number;
  reveal: number;
  parkProgress: number;
  localTime: number;
}
export interface CornerSequenceState {
  items: CornerItemState[];
  activeIndex: number | null;
  parkedCount: number;
  finale: { x: number; y: number; scale: number; opacity: number; reveal: number };
  release: number;
}

const CENTER = { x: 640, y: 350 };
const INTRO_SCALE = 1.08;
const PARKED_SCALE = .64;
const mix = (from: number, to: number, progress: number) => from + (to - from) * progress;

/** Bend vertically before crossing the parked column, keeping earlier cards unobstructed. */
function cornerPath(corner: CornerItem['corner'], progress: number) {
  const remaining = 1 - progress;
  const first = { x: mix(CENTER.x, corner.x, .16), y: mix(CENTER.y, corner.y, .75) };
  const second = { x: mix(CENTER.x, corner.x, .84), y: corner.y };
  const coordinate = (axis: 'x' | 'y') => remaining ** 3 * CENTER[axis]
    + 3 * remaining ** 2 * progress * first[axis]
    + 3 * remaining * progress ** 2 * second[axis] + progress ** 3 * corner[axis];
  return { x: coordinate('x'), y: coordinate('y') };
}

/** Absolute scene time drives every position; opacity already includes the final release. */
export function cornerSequenceState(time: number): CornerSequenceState {
  const elapsed = Number.isFinite(time) ? Math.max(0, Math.min(CORNER_FILM_SECONDS, time)) : 0;
  const release = 1 - smooth(37.5, CORNER_FILM_SECONDS, elapsed);
  const retreat = mix(.78, 1, release);
  const items = CORNER_ITEMS.map((item, index): CornerItemState => {
    const localTime = elapsed - (1 + index * 7);
    const parkProgress = smooth(4.6, 6.5, localTime);
    const arrival = smooth(0, 1.6, localTime);
    return {
      item, index, localTime, parkProgress,
      ...cornerPath(item.corner, parkProgress),
      scale: mix(mix(.3, INTRO_SCALE, arrival), PARKED_SCALE, parkProgress) * retreat,
      opacity: smooth(0, .55, localTime) * mix(1, .84, parkProgress) * release,
      reveal: smooth(.05, 1.35, localTime),
    };
  });
  const active = items.find(item => item.localTime >= 0 && item.localTime < 6.5);
  return {
    items,
    activeIndex: active?.index ?? null,
    parkedCount: items.filter(item => item.parkProgress === 1).length,
    finale: {
      ...CENTER,
      scale: mix(.3, INTRO_SCALE, smooth(CORNER_FINALE_START, 31.8, elapsed)) * retreat,
      opacity: smooth(CORNER_FINALE_START, 30.2, elapsed) * release,
      reveal: smooth(CORNER_FINALE_START, 31.1, elapsed),
    },
    release,
  };
}
