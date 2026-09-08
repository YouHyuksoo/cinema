import { smooth } from './filmDrawing';
import { createHoloProjection, type HoloPoint } from './holoSpace';

export const PROCESS_NETWORK_SECONDS = 32;
export interface ProcessReading {
  cycleSeconds: number;
  capacityPerHour: number;
  queue: number;
}
export interface ProcessNode extends ProcessReading {
  id: string;
  label: string;
  code: string;
  position: HoloPoint;
  recovery?: ProcessReading;
}
export interface ProcessLink { from: string; to: string; bend: number }
export interface ProcessNetworkData {
  title: string;
  demandPerHour: number;
  nodes: readonly ProcessNode[];
  links: readonly ProcessLink[];
}

export const DEFAULT_PROCESS_DATA: ProcessNetworkData = {
  title: 'SMT LINE / 01', demandPerHour: 480,
  nodes: [
    { id: 'load', label: '자재 투입', code: 'LOAD', position: { x: -420, y: 75, z: 80 }, cycleSeconds: 5.8, capacityPerHour: 620, queue: 2 },
    { id: 'print', label: '솔더 인쇄', code: 'PRINT', position: { x: -270, y: -110, z: -20 }, cycleSeconds: 6.4, capacityPerHour: 560, queue: 4 },
    { id: 'mount', label: '부품 실장', code: 'MOUNT', position: { x: -100, y: 75, z: 20 }, cycleSeconds: 7.1, capacityPerHour: 510, queue: 9 },
    { id: 'reflow', label: '리플로우', code: 'REFLOW', position: { x: 100, y: -30, z: 30 }, cycleSeconds: 9.6, capacityPerHour: 380, queue: 42,
      recovery: { cycleSeconds: 7.1, capacityPerHour: 510, queue: 8 } },
    { id: 'aoi', label: '광학 검사', code: 'AOI', position: { x: 285, y: 70, z: -30 }, cycleSeconds: 6.8, capacityPerHour: 540, queue: 3 },
    { id: 'unload', label: '제품 배출', code: 'OUT', position: { x: 430, y: -45, z: 120 }, cycleSeconds: 5.9, capacityPerHour: 610, queue: 1 },
  ],
  links: [
    { from: 'load', to: 'print', bend: -78 }, { from: 'print', to: 'mount', bend: 68 },
    { from: 'mount', to: 'reflow', bend: -65 }, { from: 'reflow', to: 'aoi', bend: 65 },
    { from: 'aoi', to: 'unload', bend: -65 },
  ],
};

const nonnegative = (value: number) => Number.isFinite(value) ? Math.max(0, value) : 0;
export function processCapacity(reading: ProcessReading) {
  return Math.min(nonnegative(reading.capacityPerHour), reading.cycleSeconds > 0 && Number.isFinite(reading.cycleSeconds)
    ? 3600 / reading.cycleSeconds : 0);
}

/** Demand pressure and the queue expressed in minutes choose the focal process from actual values. */
export function processBottleneck(data: ProcessNetworkData): ProcessNode | undefined {
  return data.nodes.reduce<ProcessNode | undefined>((selected, node) => {
    const pressure = (item: ProcessNode) => {
      const capacity = Math.max(1, processCapacity(item));
      return nonnegative(data.demandPerHour) / capacity + nonnegative(item.queue) * 60 / capacity;
    };
    return !selected || pressure(node) > pressure(selected) ? node : selected;
  }, undefined);
}

/** A directed cubic filament, shared by its visible path and every travelling light. */
export function processFlowPoint(from: HoloPoint, to: HoloPoint, progress: number, bend = 0): HoloPoint {
  const t = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  const u = 1 - t;
  const first = { x: from.x + (to.x - from.x) * .3, y: from.y + (to.y - from.y) * .2 + bend, z: from.z - 65 };
  const second = { x: from.x + (to.x - from.x) * .7, y: from.y + (to.y - from.y) * .8 - bend * .35, z: to.z + 65 };
  const axis = (key: keyof HoloPoint) => u ** 3 * from[key] + 3 * u ** 2 * t * first[key]
    + 3 * u * t ** 2 * second[key] + t ** 3 * to[key];
  return { x: axis('x'), y: axis('y'), z: axis('z') };
}

export interface ProcessNodeState {
  node: ProcessNode;
  index: number;
  point: HoloPoint;
  selected: boolean;
  reading: ProcessReading;
}
export function processNetworkState(time: number, data: ProcessNetworkData = DEFAULT_PROCESS_DATA) {
  const elapsed = Number.isFinite(time) ? Math.max(0, Math.min(PROCESS_NETWORK_SECONDS, time)) : 0;
  const selected = processBottleneck(data);
  const focus = smooth(6, 10, elapsed) * (1 - smooth(25, 29, elapsed));
  const recovery = selected?.recovery ? smooth(21, 27, elapsed) : 0;
  const nodes: ProcessNodeState[] = data.nodes.map((node, index) => {
    const active = node.id === selected?.id;
    const mixReading = (key: keyof ProcessReading) => nonnegative(node[key])
      + (nonnegative(node.recovery?.[key] ?? node[key]) - nonnegative(node[key])) * recovery;
    return {
      node, index, selected: active,
      point: { x: node.position.x, y: node.position.y + Math.sin(elapsed * .55 + index * 1.4) * 7,
        z: node.position.z - (active ? focus * 145 : 0) },
      reading: { cycleSeconds: mixReading('cycleSeconds'), capacityPerHour: mixReading('capacityPerHour'), queue: mixReading('queue') },
    };
  });
  const target = nodes.find(node => node.selected);
  const yaw = .13 + Math.sin(elapsed * .17) * .045, pitch = -.12;
  const vx = target ? target.point.x * Math.cos(yaw) + target.point.z * Math.sin(yaw) : 0;
  const vz = target ? -target.point.x * Math.sin(yaw) + target.point.z * Math.cos(yaw) : 0;
  const vy = target ? target.point.y * Math.cos(pitch) - vz * Math.sin(pitch) : 0;
  const camera = { x: 640, y: 340, yaw, pitch, scale: .98 + focus * .13,
    distance: 1050, panX: (vx + 140) * focus, panY: vy * focus };
  const project = createHoloProjection(camera);
  // Reserve the right-hand reading space by moving intersecting processes in the same world.
  // Their filaments and particles follow these points, so no geometry remains behind the figures.
  for (const entry of nodes) {
    if (entry.selected) continue;
    const projected = project(entry.point);
    const clearance = smooth(740, 810, projected.x) * smooth(5, 9, elapsed) * (1 - smooth(28, 30, elapsed));
    entry.point.y -= Math.max(0, projected.y - 145) * clearance / Math.max(.2, projected.scale * Math.cos(pitch));
  }
  const lineCapacity = nodes.length ? Math.min(...nodes.map(node => processCapacity(node.reading))) : 0;
  return {
    time: elapsed, nodes, focus, recovery, target,
    opacity: smooth(0, 1.2, elapsed) * (1 - smooth(30, 32, elapsed)),
    readout: smooth(9, 11, elapsed) * (1 - smooth(25, 28, elapsed)),
    camera, project,
    lineCapacity,
    flowRecovered: recovery > 0 && nonnegative(data.demandPerHour) > 0 && lineCapacity >= data.demandPerHour,
  };
}
export type ProcessNetworkState = ReturnType<typeof processNetworkState>;
