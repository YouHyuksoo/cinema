import { DEFAULT_ENERGY_DATA } from './energyCore';
import { DEFAULT_PROCESS_DATA, processCapacity } from './processNetwork';
import { DEFAULT_SPC_DATA } from './spcData';
import { analyzeSpc } from './spcStatistics';
import { DEFAULT_PRODUCT_DATA, productInspectionResult } from './productInspection';

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
  { label: '생산 진행 / OUTPUT', value: DEFAULT_ENERGY_DATA.production.value.toLocaleString('en-US'), unit: 'EA',
    fill: DEFAULT_ENERGY_DATA.production.value / DEFAULT_ENERGY_DATA.production.capacity, warning: false },
  { label: '공정 병목 / PROCESS', value: String(jarvisMainData.bottlenecks.length).padStart(2, '0'), unit: `/ ${DEFAULT_PROCESS_DATA.nodes.length}`,
    fill: jarvisMainData.bottlenecks.length / DEFAULT_PROCESS_DATA.nodes.length, warning: jarvisMainData.bottlenecks.length > 0 },
  { label: '품질 이탈 / SPC', value: jarvisMainData.quality.valid ? String(jarvisMainData.quality.violationCount).padStart(2, '0') : '—', unit: '부분군',
    fill: jarvisMainData.quality.valid ? jarvisMainData.quality.violationCount / DEFAULT_SPC_DATA.subgroups.length : 0,
    warning: jarvisMainData.quality.valid && jarvisMainData.quality.outOfControl },
  { label: '사용 전력 / POWER', value: DEFAULT_ENERGY_DATA.power.value.toFixed(1), unit: DEFAULT_ENERGY_DATA.power.unit,
    fill: DEFAULT_ENERGY_DATA.power.value / DEFAULT_ENERGY_DATA.power.capacity, warning: false },
];
