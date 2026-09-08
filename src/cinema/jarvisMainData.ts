import { DEFAULT_FILM_SCENE_DATA, type FilmSceneData } from './filmSceneData';
import { processCapacity } from './processNetwork';
import { analyzeSpc } from './spcStatistics';
import { productInspectionResult } from './productInspection';
import { environmentReadingStatus } from './zoneEnvironment';

export const HATCHERY_METRIC_KINDS = ['production', 'process', 'quality', 'power', 'efficiency', 'inspection', 'temperature', 'humidity'] as const;
export type HatcheryMetricKind = typeof HATCHERY_METRIC_KINDS[number];
export interface HatcheryMetric {
  kind: HatcheryMetricKind; label: string; value: string; unit: string; note: string; fill: number; warning: boolean;
}

/** Summary shared by the main screen, the dials and the assistant, derived from whatever the scene store holds. */
export function hatcheryMainData(data: FilmSceneData) {
  const { energy, network: process, spc: qualitySource, product } = data;
  return {
    energy, process, quality: analyzeSpc(qualitySource), qualitySource, product,
    inspection: productInspectionResult(product),
    bottlenecks: process.nodes.filter(node => processCapacity(node) < process.demandPerHour),
  };
}
export type HatcheryMainData = ReturnType<typeof hatcheryMainData>;

/** The eight top metric cards, in display order. Every value is re-derived from the scene data. */
export function hatcheryMetrics(data: FilmSceneData): HatcheryMetric[] {
  const main = hatcheryMainData(data);
  const { energy, process, quality, qualitySource, inspection, bottlenecks } = main;
  const zones = data.environment.zones;
  const environment = (kind: 'temperature' | 'humidity'): HatcheryMetric => {
    const readings = zones.map(zone => zone[kind]).filter((value): value is number => value !== null && Number.isFinite(value));
    const outside = zones.filter(zone => environmentReadingStatus(zone[kind], zone[kind === 'temperature' ? 'temperatureRange' : 'humidityRange'], kind === 'humidity') === 'outside').length;
    return { kind, label: kind === 'temperature' ? '평균 온도 / TEMPERATURE' : '평균 습도 / HUMIDITY',
      value: readings.length ? (readings.reduce((sum, value) => sum + value, 0) / readings.length).toFixed(1) : '—',
      unit: kind === 'temperature' ? '°C' : '%', fill: zones.length ? (readings.length - outside) / zones.length : 0,
      warning: outside > 0, note: `${readings.length}개 구역 · 이탈 ${outside}곳` };
  };
  return [
    { kind: 'production', note: `목표 ${energy.production.capacity.toLocaleString('en-US')} EA`, label: '생산 진행 / OUTPUT', value: energy.production.value.toLocaleString('en-US'), unit: 'EA',
      fill: energy.production.value / energy.production.capacity, warning: false },
    { kind: 'process', note: bottlenecks.map(node => node.label).join(' · ') || '병목 없음', label: '공정 병목 / PROCESS', value: String(bottlenecks.length).padStart(2, '0'), unit: `/ ${process.nodes.length}`,
      fill: process.nodes.length ? bottlenecks.length / process.nodes.length : 0, warning: bottlenecks.length > 0 },
    { kind: 'quality', note: quality.valid ? `X̄ · ${qualitySource.subgroups.length}개 부분군` : '데이터 확인 필요', label: '품질 이탈 / SPC', value: quality.valid ? String(quality.violationCount).padStart(2, '0') : '—', unit: '부분군',
      fill: quality.valid && qualitySource.subgroups.length ? quality.violationCount / qualitySource.subgroups.length : 0,
      warning: quality.valid && quality.outOfControl },
    { kind: 'power', note: `용량 ${energy.power.capacity} ${energy.power.unit}`, label: '사용 전력 / POWER', value: energy.power.value.toFixed(1), unit: energy.power.unit,
      fill: energy.power.value / energy.power.capacity, warning: false },
    { kind: 'efficiency', label: '에너지 효율 / EFFICIENCY', value: energy.efficiency.value.toFixed(1), unit: '%',
      fill: energy.efficiency.value / energy.efficiency.capacity, warning: false, note: 'SMT LINE · 시연 효율' },
    { kind: 'inspection', label: '검사 합격 / INSPECTION', value: String(inspection.passed), unit: `/ ${inspection.total}`,
      fill: inspection.total ? inspection.passed / inspection.total : 0, warning: inspection.failed > 0,
      note: `허용차 이탈 ${inspection.failed}항목` },
    environment('temperature'), environment('humidity'),
  ];
}

/** Legacy constants: the default scene data evaluated once. Prefer the functions above with store data. */
export const jarvisMainData = hatcheryMainData(DEFAULT_FILM_SCENE_DATA);
export const jarvisMainMetrics = hatcheryMetrics(DEFAULT_FILM_SCENE_DATA);
export type JarvisMetricKind = HatcheryMetricKind;
