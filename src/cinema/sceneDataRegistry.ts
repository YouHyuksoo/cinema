import type { FilmId } from './filmProgram';
import type { FilmSceneData, FilmSceneDataKey } from './filmSceneData';
import { patchObjectsById, type SceneObjectChange } from './sceneDataDocument';
import type { ProductionSnapshot } from './productionSnapshot';
import type { ZoneEnvironmentData } from './zoneEnvironment';
import type { EnergyCoreData } from './energyCore';
import type { ProcessNetworkData } from './processNetwork';
import type { ProductInspectionData } from './productInspection';
import type { SpcData } from './spcTypes';

export interface SceneDataPatchResult<K extends FilmSceneDataKey> { data: FilmSceneData[K]; applied: number; ignored: string[] }
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

function patchCollection<K extends FilmSceneDataKey, F extends string>(field: F) {
  return (data: FilmSceneData[K], objects: readonly SceneObjectChange[]): SceneDataPatchResult<K> => {
    const items = (data as unknown as Record<F, readonly { id: string }[]>)[field];
    const result = patchObjectsById(items, objects);
    return { data: { ...data, [field]: result.items } as FilmSceneData[K], applied: result.applied, ignored: result.ignored };
  };
}

const production: SceneDataEntry<'production'> = {
  key: 'production',
  normalize: data => isRecord(data) && isText(data.unit) && isNumber(data.target)
    && listOf(data.lines, line => isText(line.id) && isText(line.label) && isNumber(line.value))
    && (data.selectedId === undefined || data.selectedId === null || typeof data.selectedId === 'string')
    ? data as unknown as ProductionSnapshot : undefined,
  patch: patchCollection<'production', 'lines'>('lines'),
};

const environment: SceneDataEntry<'environment'> = {
  key: 'environment',
  normalize: data => isRecord(data) && isText(data.title)
    && listOf(data.zones, zone => isText(zone.id) && isText(zone.name) && isNumberOrNull(zone.temperature) && isNumberOrNull(zone.humidity)
      && isRange(zone.temperatureRange) && isRange(zone.humidityRange))
    ? data as unknown as ZoneEnvironmentData : undefined,
  patch: patchCollection<'environment', 'zones'>('zones'),
};

const network: SceneDataEntry<'network'> = {
  key: 'network',
  normalize: data => isRecord(data) && isText(data.title) && isNumber(data.demandPerHour)
    && listOf(data.nodes, node => isText(node.id) && isText(node.label) && isText(node.code) && isPoint(node.position)
      && isNumber(node.cycleSeconds) && isNumber(node.capacityPerHour) && isNumber(node.queue))
    && listOf(data.links, link => isText(link.from) && isText(link.to) && isNumber(link.bend))
    ? data as unknown as ProcessNetworkData : undefined,
  patch: patchCollection<'network', 'nodes'>('nodes'),
};

const spc: SceneDataEntry<'spc'> = {
  key: 'spc',
  normalize: data => isRecord(data) && isText(data.name) && isText(data.unit)
    && [data.nominal, data.lsl, data.usl, data.cpkTarget].every(isNumber)
    && listOf(data.subgroups, group => isText(group.id) && isNumberList(group.values))
    ? data as unknown as SpcData : undefined,
  patch: patchCollection<'spc', 'subgroups'>('subgroups'),
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
export const SCENE_DATA_REGISTRY: Partial<Record<FilmId, SceneDataEntry>> = {
  bars: production, pie: production, wave: environment, network, spc, energy, product,
};

export function sceneDataEntry(scene: string): SceneDataEntry | undefined {
  return Object.prototype.hasOwnProperty.call(SCENE_DATA_REGISTRY, scene) ? SCENE_DATA_REGISTRY[scene as FilmId] : undefined;
}
