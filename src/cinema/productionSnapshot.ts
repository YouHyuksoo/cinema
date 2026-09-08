import { findSceneObject, normalizeSceneObjects, type SceneObject } from './sceneObject';

export interface ProductionLine extends SceneObject { value: number; color?: string; accent?: boolean }
export interface ProductionSnapshot {
  unit: string;
  /** Per-line target. */
  target: number;
  lines: readonly ProductionLine[];
  /** Line to bring forward; falls back to the lowest attainment below target. */
  selectedId?: string | null;
}
export interface ProductionSnapshotState {
  lines: ProductionLine[];
  unit: string;
  target: number;
  total: number;
  aggregateTarget: number;
  aggregateRatio: number;
  reached: number;
  /** Chart scale that contains every value and the target with headroom. */
  maximum: number;
  selectedIndex: number | undefined;
  selected: ProductionLine | undefined;
}

/** The demo snapshot the bar and pie scenes both start from. */
export const DEFAULT_PRODUCTION_SNAPSHOT: ProductionSnapshot = {
  unit: 'EA', target: 800,
  lines: [
    { id: 'LINE-01', label: 'LINE 01', value: 860, color: '#5fe3ff' },
    { id: 'LINE-02', label: 'LINE 02', value: 720, color: '#79b7a9' },
    { id: 'LINE-03', label: 'LINE 03', value: 940, color: '#c4e7f0' },
    { id: 'LINE-04', label: 'LINE 04', value: 610, color: '#ffc168', accent: true },
    { id: 'LINE-05', label: 'LINE 05', value: 790, color: '#398698' },
  ],
};

const positive = (value: number | undefined) => Number.isFinite(value) && value! > 0 ? value! : 0;
const SCALE_STEPS = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10] as const;
const SCALE_HEADROOM = 1.15;

/** selectedId wins; otherwise the lowest attainment below target; nothing when all lines reached it. */
export function selectProductionLine(lines: readonly ProductionLine[], target: number, selectedId?: string | null): number | undefined {
  const chosen = findSceneObject(lines, selectedId);
  if (chosen) return lines.indexOf(chosen);
  const goal = positive(target);
  if (!goal) return undefined;
  let index: number | undefined, lowest = Infinity;
  lines.forEach((line, position) => {
    const ratio = positive(line.value) / goal;
    if (ratio < 1 && ratio < lowest) { lowest = ratio; index = position; }
  });
  return index;
}

/** Readable ceiling: peak × headroom rounded up to a 1 / 1.2 / 1.5 / 2 / 2.5 / 3 / 4 / 5 / 6 / 8 / 10 step. */
export function productionScale(lines: readonly ProductionLine[], target: number) {
  const peak = lines.reduce((max, line) => Math.max(max, positive(line.value)), Math.max(1, positive(target)));
  const padded = peak * SCALE_HEADROOM;
  const magnitude = 10 ** Math.floor(Math.log10(padded));
  const step = SCALE_STEPS.find(candidate => candidate * magnitude >= padded - 1e-9) ?? 10;
  return step * magnitude;
}

export function productionSnapshotState(snapshot: ProductionSnapshot): ProductionSnapshotState {
  const lines = normalizeSceneObjects(snapshot?.lines ?? []).map(line => ({ ...line, value: positive(line.value) }));
  const target = positive(snapshot?.target);
  const unit = typeof snapshot?.unit === 'string' && snapshot.unit.trim() ? snapshot.unit.trim() : 'EA';
  const total = lines.reduce((sum, line) => sum + line.value, 0);
  const aggregateTarget = target * lines.length;
  const aggregateRatio = aggregateTarget > 0 ? total / aggregateTarget : 0;
  const reached = target > 0 ? lines.filter(line => line.value >= target).length : 0;
  const selectedIndex = selectProductionLine(lines, target, snapshot?.selectedId);
  return { lines, unit, target, total, aggregateTarget, aggregateRatio, reached,
    maximum: productionScale(lines, target), selectedIndex,
    selected: selectedIndex === undefined ? undefined : lines[selectedIndex] };
}
