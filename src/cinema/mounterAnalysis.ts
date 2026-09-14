import type { SceneFieldDescriptor } from './sceneField';
import { normalizeSceneObjects, type SceneObject } from './sceneObject';

export type MetricDirection = 'higher' | 'lower';
export interface MounterMetric extends SceneObject {
  machineId: string; machineLabel: string; value: number; target: number; unit: string;
  direction: MetricDirection; color?: string;
}
export interface MounterAnalysisData { name: string; metrics: readonly MounterMetric[] }

export const MOUNTER_METRIC_FIELDS: readonly SceneFieldDescriptor[] = [
  { field: 'value', label: '현재값', kind: 'number', min: 0, decimals: 2, patchable: true, aliases: /현재값|측정값|값/, default: true },
  { field: 'target', label: '기준값', kind: 'number', min: 0, decimals: 2 },
  { field: 'unit', label: '단위', kind: 'text' },
  { field: 'direction', label: '판정 방향', kind: 'text', allowedValues: ['higher', 'lower'] },
];

const METRICS = [
  { key: 'pickup-rate', label: '픽업률', target: 99.5, unit: '%', direction: 'higher', color: '#5fe3ff' },
  { key: 'loss-rate', label: '로스율', target: .5, unit: '%', direction: 'lower', color: '#ffbd69' },
  { key: 'recognition-error', label: '인식 오류율', target: .25, unit: '%', direction: 'lower', color: '#ff8d73' },
  { key: 'cycle-time', label: '사이클타임', target: 7.5, unit: 's', direction: 'lower', color: '#7be6c4' },
  { key: 'nozzle-defect', label: '노즐 불량', target: 2, unit: '건', direction: 'lower', color: '#d6b5ff' },
  { key: 'head-defect', label: '헤더 불량', target: 1, unit: '건', direction: 'lower', color: '#86a9ff' },
] as const;

const MACHINE_VALUES = [
  [99.2, .72, .34, 7.1, 3, 1], [99.7, .31, .18, 6.9, 1, 0], [99.4, .48, .22, 7.3, 2, 1],
  [98.9, .83, .41, 7.8, 4, 2], [99.6, .39, .2, 7.0, 1, 1],
] as const;

export const DEFAULT_MOUNTER_ANALYSIS: MounterAnalysisData = {
  name: 'SMT LINE 03 / MOUNTER ANALYSIS',
  metrics: MACHINE_VALUES.flatMap((values, machineIndex) => {
    const machineId = `M${String(machineIndex + 1).padStart(2, '0')}`;
    const machineLabel = `MOUNTER ${String(machineIndex + 1).padStart(2, '0')}`;
    return METRICS.map((metric, metricIndex): MounterMetric => ({
      id: `${machineId}-${metric.key}`, label: metric.label, machineId, machineLabel,
      value: values[metricIndex], target: metric.target, unit: metric.unit,
      direction: metric.direction, color: metric.color,
    }));
  }),
};

const positive = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
export function mounterAnalysisState(data: MounterAnalysisData) {
  const metrics = normalizeSceneObjects(data?.metrics ?? []).map(metric => {
    const value = positive(metric.value), target = positive(metric.target);
    const direction: MetricDirection = metric.direction === 'higher' ? 'higher' : 'lower';
    const performance = target <= 0 ? 100 : direction === 'higher' ? value / target * 100 : value <= 0 ? 120 : target / value * 100;
    const machineId = typeof metric.machineId === 'string' && metric.machineId.trim() ? metric.machineId.trim() : 'M01';
    const machineLabel = typeof metric.machineLabel === 'string' && metric.machineLabel.trim() ? metric.machineLabel.trim() : machineId;
    return { ...metric, machineId, machineLabel, value, target, direction,
      unit: typeof metric.unit === 'string' ? metric.unit : '', performance: Math.min(120, performance) };
  });
  const ids = [...new Set(metrics.map(metric => metric.machineId))].slice(0, 5);
  const mounters = ids.map(id => {
    const machineMetrics = metrics.filter(metric => metric.machineId === id);
    const normal = machineMetrics.filter(metric => metric.performance >= 100).length;
    const score = machineMetrics.length ? machineMetrics.reduce((sum, metric) => sum + metric.performance, 0) / machineMetrics.length : 0;
    return { id, label: machineMetrics[0]?.machineLabel ?? id, metrics: machineMetrics, normal, score };
  });
  return { name: typeof data?.name === 'string' && data.name.trim() ? data.name.trim() : 'SMT MOUNTER LINE', metrics, mounters };
}

/** Five-machine visor-like tour: hold on a machine, then slide sideways to the next one. */
export function mounterTourState(count: number, time: number) {
  const last = Math.max(0, Math.min(4, count - 1));
  const segment = 5;
  const from = Math.min(last, Math.floor(Math.max(0, time) / segment));
  const local = Math.max(0, time) - from * segment;
  const to = Math.min(last, from + 1);
  const move = local <= 3.35 ? 0 : Math.min(1, (local - 3.35) / 1.65);
  const eased = move * move * (3 - 2 * move);
  const focus = from + (to - from) * eased;
  return { focus, activeIndex: Math.min(last, Math.round(focus)) };
}
