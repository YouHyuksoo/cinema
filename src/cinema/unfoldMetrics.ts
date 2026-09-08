import { CORNER_PRODUCTION } from './cornerSequence';
import { smooth } from './filmDrawing';
import { FILM_DURATIONS } from './filmProgram';

export const UNFOLD_HUB = { x: 640, y: 345 } as const;
export const UNFOLD_CARD_SIZE = { width: 800, height: 340 } as const;

export interface UnfoldMetric {
  id: 'production' | 'quality' | 'cycle' | 'remaining';
  key: string;
  label: string;
  value: string;
  numericValue: number;
  unit: string;
  baseline: number;
  reference: string;
  difference: string;
  deviation: number;
  heat: number;
  target: { x: number; y: number; scale: number };
}

const productionValue = CORNER_PRODUCTION.achievement.toFixed(1);
const productionGap = (100 - Number(productionValue)).toFixed(1);

export const UNFOLD_METRICS = [
  { id: 'production', key: '01 / PRODUCTION PACE', label: '생산 달성', value: productionValue,
    numericValue: Number(productionValue), unit: '%', baseline: 100,
    reference: `${CORNER_PRODUCTION.actual.toLocaleString('en-US')} / ${CORNER_PRODUCTION.target.toLocaleString('en-US')} EA`,
    difference: `계획 대비 −${productionGap}%`, deviation: -Number(productionGap), heat: 0,
    target: { x: 330, y: 270, scale: .54 } },
  { id: 'quality', key: '02 / FIRST PASS YIELD', label: '양품률', value: '96.4',
    numericValue: 96.4, unit: '%', baseline: 99.2,
    reference: '기준 99.2%', difference: '−2.8%p', deviation: -2.8, heat: 1,
    target: { x: 935, y: 253, scale: .46 } },
  { id: 'cycle', key: '03 / CYCLE TIME', label: '사이클 타임', value: '8.2',
    numericValue: 8.2, unit: 's', baseline: 7.1,
    reference: '기준 7.1 s', difference: '+1.1 s', deviation: 1.1, heat: 1,
    target: { x: 935, y: 490, scale: .46 } },
  { id: 'remaining', key: '04 / REMAINING PLAN', label: '생산 잔여', value: String(CORNER_PRODUCTION.remaining),
    numericValue: CORNER_PRODUCTION.remaining, unit: 'EA', baseline: 0,
    reference: `목표 ${CORNER_PRODUCTION.target.toLocaleString('en-US')} EA`,
    difference: `실적 ${CORNER_PRODUCTION.actual.toLocaleString('en-US')} EA`, deviation: CORNER_PRODUCTION.remaining, heat: 0,
    target: { x: 330, y: 525, scale: .54 } },
] as const satisfies readonly UnfoldMetric[];

export interface UnfoldMetricState {
  metric: UnfoldMetric;
  index: number;
  x: number;
  y: number;
  scale: number;
  opacity: number;
  focus: number;
  reveal: number;
  rotation: number;
  port: { x: number; y: number };
  appear: number;
  countProgress: number;
  displayValue: string;
  morph: number;
  settled: number;
}

export interface UnfoldMetricsState {
  elapsed: number;
  presence: number;
  activeIndex: number | null;
  overview: number;
  items: UnfoldMetricState[];
}

const mix = (from: number, to: number, amount: number) => from + (to - from) * amount;

/** A number becomes its chart before following a shallow curve into the summary. */
function chartPosition(target: UnfoldMetric['target'], settled: number) {
  return {
    x: mix(UNFOLD_HUB.x, target.x, settled),
    y: mix(UNFOLD_HUB.y, target.y, settled) - Math.sin(Math.PI * settled) * 28,
  };
}

/** Every chart remains assembled after arrival; absolute time supports backward seeking. */
export function unfoldMetricsState(time: number): UnfoldMetricsState {
  const elapsed = Number.isFinite(time) ? Math.max(0, Math.min(FILM_DURATIONS.unfold, time)) : 0;
  const presence = smooth(0, 1.25, elapsed) * (1 - smooth(30, FILM_DURATIONS.unfold, elapsed));
  const activeIndex = elapsed >= 2 && elapsed < 26 ? Math.floor((elapsed - 2) / 6) : null;
  const activeTime = activeIndex === null ? 0 : elapsed - (2 + activeIndex * 6);
  const frontPresence = activeIndex === null ? 0
    : smooth(0, .3, activeTime) * (1 - smooth(4.5, 5.7, activeTime));
  const overview = smooth(26, 28, elapsed);
  const items = UNFOLD_METRICS.map((metric, index): UnfoldMetricState => {
    const localTime = elapsed - (2 + index * 6);
    const appear = smooth(0, 1, localTime);
    const countTime = Math.max(0, Math.min(1, (localTime - .55) / 1.4));
    const countProgress = 1 - (1 - countTime) ** 3;
    const precision = metric.value.split('.')[1]?.length ?? 0;
    const displayValue = countProgress === 1 ? metric.value
      : (metric.numericValue * countProgress).toFixed(precision);
    const morph = smooth(2.5, 4, localTime);
    const settled = smooth(4, 5.7, localTime);
    const position = chartPosition(metric.target, settled);
    const scale = mix(.9, 1, appear) * mix(1, metric.target.scale, settled);
    const backgroundDim = activeIndex !== null && index < activeIndex ? 1 - .85 * frontPresence : 1;
    return {
      metric, index, ...position, scale, appear, countProgress, displayValue, morph, settled,
      opacity: presence * appear * backgroundDim,
      focus: appear * (1 - settled),
      reveal: appear,
      rotation: Math.sin(Math.PI * settled) * (index % 2 ? 1 : -1) * .055,
      port: { x: position.x, y: position.y + UNFOLD_CARD_SIZE.height * scale / 2 },
    };
  });
  return { elapsed, presence, activeIndex, overview, items };
}
