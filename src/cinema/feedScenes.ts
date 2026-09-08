import type { SceneDataDocument, SceneDataSource } from './sceneDataDocument';
import type { FilmId } from './filmProgram';

type Item = Record<string, unknown>;
const list = (value: unknown): Item[] => Array.isArray(value) ? value.filter((item): item is Item => typeof item === 'object' && item !== null) : [];

/**
 * Feed data (what a database delivers) → scene documents (what the store accepts).
 * Scenes not migrated yet (equipment, workOrder, machine) produce nothing until their
 * object models exist; the registry then rejects nothing because nothing is sent.
 */
export function feedToSceneDocuments(feedId: string, data: Record<string, unknown>, envelope: { source: SceneDataSource; at: string }): SceneDataDocument[] {
  const document = (scene: FilmId, payload: unknown): SceneDataDocument => ({ scene, version: 1, source: envelope.source, at: envelope.at, data: payload });
  switch (feedId) {
    case 'production':
      return [document('bars', { unit: data.unit, target: data.target, ...(data.selectedId !== undefined ? { selectedId: data.selectedId } : {}), lines: list(data.lines) })];
    case 'environment':
      return [document('wave', { title: data.title, ...(data.historyEnd !== undefined ? { historyEnd: data.historyEnd } : {}),
        zones: list(data.zones).map(zone => ({ ...zone, name: zone.name ?? zone.label })) })];
    case 'process':
      return [document('network', { title: data.title, demandPerHour: data.demandPerHour, nodes: list(data.nodes),
        links: list(data.links).map(link => ({ from: link.from, to: link.to, bend: typeof link.bend === 'number' ? link.bend : 0 })) })];
    case 'quality':
      return [document('spc', { name: data.name, unit: data.unit, nominal: data.nominal, lsl: data.lsl, usl: data.usl, cpkTarget: data.cpkTarget,
        subgroups: list(data.subgroups).map(group => ({ id: group.id, values: group.values })) })];
    case 'energy': {
      const readings = list(data.readings);
      const reading = (id: string) => { const item = readings.find(entry => entry.id === id); return item ? { value: item.value, capacity: item.capacity, unit: item.unit } : undefined; };
      const power = reading('power'), production = reading('production'), efficiency = reading('efficiency');
      if (!power || !production || !efficiency) return [];
      return [document('energy', { name: data.name, power, production, efficiency })];
    }
    case 'inspection':
      return [document('product', { name: data.name, serial: data.serial,
        measurements: list(data.measurements).map(item => ({ zone: item.id, label: item.label, nominal: item.nominal, actual: item.actual, tolerance: item.tolerance, unit: item.unit, decimals: item.decimals })) })];
    default:
      return [];
  }
}
