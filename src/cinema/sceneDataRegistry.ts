import type { FilmId } from './filmProgram';
import type { FilmSceneData, FilmSceneDataKey } from './filmSceneData';
import { patchObjectsById, type SceneObjectChange } from './sceneDataDocument';
import type { ProductionSnapshot } from './productionSnapshot';
import type { ZoneEnvironmentData } from './zoneEnvironment';
import type { EnergyCoreData } from './energyCore';
import type { ProcessNetworkData } from './processNetwork';
import type { ProductInspectionData } from './productInspection';
import type { SpcData } from './spcTypes';
import type { OeeData } from './oeeData';
import { validateSceneField, validateSceneObjectFields, type SceneFieldDescriptor } from './sceneField';
import { SCENE_FIELDS } from './sceneFields';
import { PRODUCTION_LINE_FIELDS } from './productionLineFields';
import { validatePcbInspectionData } from './pcbInspection';
import type { PcbInspectionData } from './pcbInspectionData';
import { MOUNTER_METRIC_FIELDS, type MounterAnalysisData } from './mounterAnalysis';

export interface SceneDataPatchResult<K extends FilmSceneDataKey> { data: FilmSceneData[K]; applied: number; ignored: string[]; error?: string }
export interface SceneDataEntry<K extends FilmSceneDataKey = FilmSceneDataKey> {
  key: K;
  /** Structural check only; scene state functions do the semantic validation. */
  normalize(data: unknown): FilmSceneData[K] | undefined;
  /** Absent for fixed-shape scenes (contract level L1): they accept full replacements only. */
  patch?(data: FilmSceneData[K], objects: readonly SceneObjectChange[]): SceneDataPatchResult<K>;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const isNumber = (value: unknown): value is number => typeof value === 'number';
const isNumberOrNull = (value: unknown) => value === null || isNumber(value);
const isRange = (value: unknown) => isRecord(value) && isNumber(value.min) && isNumber(value.max);
const isNumberList = (value: unknown) => Array.isArray(value) && value.every(isNumber);
const isReading = (value: unknown) => isRecord(value) && isNumber(value.value) && isNumber(value.capacity) && isText(value.unit);
const isPoint = (value: unknown) => isRecord(value) && isNumber(value.x) && isNumber(value.y) && isNumber(value.z);
const listOf = (value: unknown, check: (item: Record<string, unknown>) => boolean) => Array.isArray(value) && value.every(item => isRecord(item) && check(item));

/** A patch may only touch declared, patchable fields with values that satisfy their descriptors. */
function validateChanges(descriptors: readonly SceneFieldDescriptor[], objects: readonly SceneObjectChange[]): string | undefined {
  for (const change of objects) {
    for (const key of Object.keys(change)) {
      if (key === 'id' || key === 'label') continue;
      const descriptor = descriptors.find(item => item.field === key);
      if (!descriptor?.patchable) return `패치로 바꿀 수 없는 항목입니다: ${key}`;
      const result = validateSceneField(descriptor, change[key]);
      if (!result.ok) return result.reason;
    }
  }
  return undefined;
}

function patchCollection<K extends FilmSceneDataKey, F extends string>(field: F, descriptors: readonly SceneFieldDescriptor[]) {
  return (data: FilmSceneData[K], objects: readonly SceneObjectChange[]): SceneDataPatchResult<K> => {
    const error = validateChanges(descriptors, objects);
    if (error) return { data, applied: 0, ignored: [], error };
    const items = (data as unknown as Record<F, readonly { id: string }[]>)[field];
    const result = patchObjectsById(items, objects);
    return { data: { ...data, [field]: result.items } as FilmSceneData[K], applied: result.applied, ignored: result.ignored };
  };
}

const production: SceneDataEntry<'production'> = {
  key: 'production',
  normalize: data => isRecord(data) && isText(data.unit) && isNumber(data.target)
    && listOf(data.lines, line => isText(line.id) && isText(line.label) && validateSceneObjectFields(PRODUCTION_LINE_FIELDS, line, { required: true }).ok)
    && (data.selectedId === undefined || data.selectedId === null || typeof data.selectedId === 'string')
    ? data as unknown as ProductionSnapshot : undefined,
  patch: patchCollection<'production', 'lines'>('lines', SCENE_FIELDS.bars),
};

const mounter: SceneDataEntry<'mounter'> = {
  key: 'mounter',
  normalize: data => isRecord(data) && isText(data.name)
    && listOf(data.metrics, metric => isText(metric.id) && isText(metric.label) && isText(metric.machineId) && isText(metric.machineLabel)
      && validateSceneObjectFields(MOUNTER_METRIC_FIELDS, metric, { required: true }).ok)
    ? data as unknown as MounterAnalysisData : undefined,
  patch: patchCollection<'mounter', 'metrics'>('metrics', MOUNTER_METRIC_FIELDS),
};

const environment: SceneDataEntry<'environment'> = {
  key: 'environment',
  normalize: data => isRecord(data) && isText(data.title)
    && listOf(data.zones, zone => isText(zone.id) && isText(zone.name) && isNumberOrNull(zone.temperature) && isNumberOrNull(zone.humidity)
      && isRange(zone.temperatureRange) && isRange(zone.humidityRange))
    ? data as unknown as ZoneEnvironmentData : undefined,
  patch: patchCollection<'environment', 'zones'>('zones', SCENE_FIELDS.wave),
};

const network: SceneDataEntry<'network'> = {
  key: 'network',
  normalize: data => isRecord(data) && isText(data.title) && isNumber(data.demandPerHour)
    && listOf(data.nodes, node => isText(node.id) && isText(node.label) && isText(node.code) && isPoint(node.position)
      && isNumber(node.cycleSeconds) && isNumber(node.capacityPerHour) && isNumber(node.queue))
    && listOf(data.links, link => isText(link.from) && isText(link.to) && isNumber(link.bend))
    ? data as unknown as ProcessNetworkData : undefined,
  patch: patchCollection<'network', 'nodes'>('nodes', SCENE_FIELDS.network),
};

const isSpcMeasurement = (data: unknown) => isRecord(data) && isText(data.name) && isText(data.unit)
  && [data.nominal, data.lsl, data.usl, data.cpkTarget].every(isNumber)
  && listOf(data.subgroups, group => isText(group.id) && isNumberList(group.values));
const spc: SceneDataEntry<'spc'> = {
  key: 'spc',
  normalize: data => isRecord(data) && isSpcMeasurement(data)
    && (data.targets === undefined || (listOf(data.targets, target => isText(target.id) && isSpcMeasurement(target))
      && new Set((data.targets as { id: string }[]).map(target => target.id)).size === (data.targets as unknown[]).length))
    ? data as unknown as SpcData : undefined,
  patch: (data, objects) => data.targets !== undefined
    ? { data, applied: 0, ignored: [], error: '다중 SPC 대상은 targets를 포함한 전체 스냅샷으로 갱신하세요.' }
    : patchCollection<'spc', 'subgroups'>('subgroups', SCENE_FIELDS.spc)(data, objects),
};

const energy: SceneDataEntry<'energy'> = {
  key: 'energy',
  normalize: data => isRecord(data) && isText(data.name) && isReading(data.power) && isReading(data.production) && isReading(data.efficiency)
    ? data as unknown as EnergyCoreData : undefined,
};

const product: SceneDataEntry<'product'> = {
  key: 'product',
  normalize: data => isRecord(data) && isText(data.name) && isText(data.serial)
    && listOf(data.measurements, item => isText(item.zone) && isText(item.label) && [item.nominal, item.actual, item.tolerance, item.decimals].every(isNumber) && isText(item.unit))
    ? data as unknown as ProductInspectionData : undefined,
};

/** Scene id → data key, structural normalizer and (for L2 scenes) an id-addressed patcher. */
const pcb: SceneDataEntry<'pcb'> = {
  key: 'pcb',
  normalize: data => validatePcbInspectionData(data).valid ? data as PcbInspectionData : undefined,
  patch: patchCollection<'pcb', 'components'>('components', SCENE_FIELDS.machine),
};

export const SCENE_DATA_REGISTRY: Partial<Record<FilmId, SceneDataEntry>> = {
  oee: { key: 'oee', normalize: data => isRecord(data) && isText(data.name) && isText(data.period)
    && listOf(data.equipment, item => isText(item.id) && isText(item.name)
      && [item.plannedSeconds, item.stopSeconds, item.idealCycleSeconds, item.totalCount, item.goodCount].every(isNumber))
    ? data as unknown as OeeData : undefined },
  bars: mounter, pie: production, wave: environment, network, spc, energy, product, machine: pcb,
};

export function sceneDataEntry(scene: string): SceneDataEntry | undefined {
  return Object.prototype.hasOwnProperty.call(SCENE_DATA_REGISTRY, scene) ? SCENE_DATA_REGISTRY[scene as FilmId] : undefined;
}
