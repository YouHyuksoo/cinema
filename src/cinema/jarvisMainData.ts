import { DEFAULT_ENERGY_DATA } from './energyCore';
import { DEFAULT_PROCESS_DATA, processCapacity } from './processNetwork';
import { DEFAULT_SPC_DATA } from './spcData';
import { analyzeSpc } from './spcStatistics';
import { DEFAULT_PRODUCT_DATA, productInspectionResult } from './productInspection';
import { DEFAULT_ENVIRONMENT_DATA, environmentReadingStatus } from './zoneEnvironment';

/** One snapshot shared by the main summaries and both streams, sourced from the scene fixtures. */
export const jarvisMainData = {
  energy: DEFAULT_ENERGY_DATA,
  process: DEFAULT_PROCESS_DATA,
  quality: analyzeSpc(DEFAULT_SPC_DATA),
  qualitySource: DEFAULT_SPC_DATA,
  product: DEFAULT_PRODUCT_DATA,
  inspection: productInspectionResult(DEFAULT_PRODUCT_DATA),
  bottlenecks: DEFAULT_PROCESS_DATA.nodes.filter(node => processCapacity(node) < DEFAULT_PROCESS_DATA.demandPerHour),
};
export const jarvisMainMetrics = [
  { kind: 'production', note: `목표 ${DEFAULT_ENERGY_DATA.production.capacity.toLocaleString('en-US')} EA`, label: '생산 진행 / OUTPUT', value: DEFAULT_ENERGY_DATA.production.value.toLocaleString('en-US'), unit: 'EA',
    fill: DEFAULT_ENERGY_DATA.production.value / DEFAULT_ENERGY_DATA.production.capacity, warning: false },
  { kind: 'process', note: jarvisMainData.bottlenecks.map(node => node.label).join(' · ') || '병목 없음', label: '공정 병목 / PROCESS', value: String(jarvisMainData.bottlenecks.length).padStart(2, '0'), unit: `/ ${DEFAULT_PROCESS_DATA.nodes.length}`,
    fill: jarvisMainData.bottlenecks.length / DEFAULT_PROCESS_DATA.nodes.length, warning: jarvisMainData.bottlenecks.length > 0 },
  { kind: 'quality', note: jarvisMainData.quality.valid ? `X̄ · ${DEFAULT_SPC_DATA.subgroups.length}개 부분군` : '데이터 확인 필요', label: '품질 이탈 / SPC', value: jarvisMainData.quality.valid ? String(jarvisMainData.quality.violationCount).padStart(2, '0') : '—', unit: '부분군',
    fill: jarvisMainData.quality.valid ? jarvisMainData.quality.violationCount / DEFAULT_SPC_DATA.subgroups.length : 0,
    warning: jarvisMainData.quality.valid && jarvisMainData.quality.outOfControl },
  { kind: 'power', note: `용량 ${DEFAULT_ENERGY_DATA.power.capacity} ${DEFAULT_ENERGY_DATA.power.unit}`, label: '사용 전력 / POWER', value: DEFAULT_ENERGY_DATA.power.value.toFixed(1), unit: DEFAULT_ENERGY_DATA.power.unit,
    fill: DEFAULT_ENERGY_DATA.power.value / DEFAULT_ENERGY_DATA.power.capacity, warning: false },
  { kind: 'efficiency', label: '에너지 효율 / EFFICIENCY', value: DEFAULT_ENERGY_DATA.efficiency.value.toFixed(1), unit: '%',
    fill: DEFAULT_ENERGY_DATA.efficiency.value / DEFAULT_ENERGY_DATA.efficiency.capacity, warning: false, note: 'SMT LINE · 시연 효율' },
  { kind: 'inspection', label: '검사 합격 / INSPECTION', value: String(jarvisMainData.inspection.passed), unit: `/ ${jarvisMainData.inspection.total}`,
    fill: jarvisMainData.inspection.passed / jarvisMainData.inspection.total, warning: jarvisMainData.inspection.failed > 0,
    note: `허용차 이탈 ${jarvisMainData.inspection.failed}항목` },
  ...(['temperature', 'humidity'] as const).map(kind => {
    const zones = DEFAULT_ENVIRONMENT_DATA.zones;
    const readings = zones.map(zone => zone[kind]).filter((value): value is number => value !== null && Number.isFinite(value));
    const outside = zones.filter(zone => environmentReadingStatus(zone[kind], zone[kind === 'temperature' ? 'temperatureRange' : 'humidityRange'], kind === 'humidity') === 'outside').length;
    return { kind, label: kind === 'temperature' ? '평균 온도 / TEMPERATURE' : '평균 습도 / HUMIDITY',
      value: readings.length ? (readings.reduce((sum, value) => sum + value, 0) / readings.length).toFixed(1) : '—',
      unit: kind === 'temperature' ? '°C' : '%', fill: zones.length ? (readings.length - outside) / zones.length : 0,
      warning: outside > 0, note: `${readings.length}개 구역 · 이탈 ${outside}곳` };
  }),
] as const;
export type JarvisMetricKind = typeof jarvisMainMetrics[number]['kind'];
