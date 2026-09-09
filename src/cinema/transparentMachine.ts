import { smooth } from './filmDrawing';
import { mix } from './filmMath';
import { createHoloProjection, type HoloPoint } from './holoSpace';

export const MACHINE_FILM_SECONDS = 36;
export const PHONE_BODY = { width: 240, height: 420, radius: 27 } as const;
export const PHONE_CPU_ANCHOR: HoloPoint = { x: 48, y: -106, z: -8 };
export type MachinePartId = 'shell' | 'camera' | 'board' | 'battery' | 'display';
export type MachineLayer = MachinePartId;
export interface MachineMetric {
  label: string; value: number; unit: string; max: number;
  warningAbove?: number; decimals?: number;
}
export interface MachineReading { name: string; description?: string; metrics: readonly MachineMetric[] }
export interface TransparentMachineData { name: string; parts: Record<MachinePartId, MachineReading> }
export const DEFAULT_MACHINE_DATA: TransparentMachineData = {
  name: 'AURORA / EXPLODED HANDSET',
  parts: {
    shell: { name: '뒤판', description: '무광 후면 커버 · 가공 프레임 · 카메라 개구부', metrics: [] },
    camera: { name: '카메라', description: '독립 듀얼 렌즈 모듈 · 광학 코팅 · 연결 단자', metrics: [] },
    board: { name: '메인 기판', description: 'CPU · 메모리 · 전원 IC · 실장 부품과 배선', metrics: [
      { label: 'CPU TEMPERATURE', value: 42.6, unit: '°C', max: 85, warningAbove: 70, decimals: 1 },
      { label: 'CLOCK FREQUENCY', value: 2.84, unit: 'GHz', max: 3.2, decimals: 2 },
      { label: 'CPU LOAD', value: 68, unit: '%', max: 100, decimals: 0 },
    ] },
    battery: { name: '배터리', description: '분리된 배터리 셀 · 보호 포장 · 전원 커넥터', metrics: [
      { label: 'VOLTAGE', value: 3.85, unit: 'V', max: 4.4, decimals: 2 },
      { label: 'CAPACITY', value: 5050, unit: 'mAh', max: 5050, decimals: 0 },
    ] },
    display: { name: '디스플레이', description: '전면 유리 · OLED 패널 · 터치 센서', metrics: [
      { label: 'LUMINANCE', value: 620, unit: 'nit', max: 1000, decimals: 0 },
      { label: 'REFRESH RATE', value: 120, unit: 'Hz', max: 144, decimals: 0 },
    ] },
  },
};
export const MACHINE_PART_IDS: readonly MachinePartId[] = ['shell', 'camera', 'board', 'battery', 'display'];
export const PHONE_FOCUS_ORDER: readonly MachinePartId[] = ['camera', 'board', 'battery', 'display', 'shell'];
export const PHONE_PART_SIZE: Record<MachinePartId, { width: number; height: number; depth: number }> = {
  shell: { width: 246, height: 420, depth: 14 },
  camera: { width: 48, height: 92, depth: 18 },
  board: { width: 210, height: 378, depth: 20 },
  battery: { width: 150, height: 212, depth: 12 },
  display: { width: 240, height: 420, depth: 8 },
};
export const PHONE_CLOSED_CENTRES: Record<MachinePartId, HoloPoint> = {
  shell: { x: 0, y: 0, z: 24 }, camera: { x: -65, y: -118, z: 8 },
  board: { x: 0, y: 0, z: 0 }, battery: { x: 22, y: 54, z: -8 },
  display: { x: 0, y: 0, z: -22 },
};
const OPEN_CENTRES: Record<MachinePartId, HoloPoint> = {
  shell: { x: -443, y: 0, z: 90 }, camera: { x: -304, y: -171, z: -105 },
  board: { x: -115, y: 58, z: 0 }, battery: { x: 153, y: 55, z: -58 },
  display: { x: 425, y: -5, z: -135 },
};
const openEase = (start: number, end: number, time: number) => {
  const value = Math.max(0, Math.min(1, (time - start) / (end - start)));
  return 1 - (1 - value) ** 3;
};

/** A brisk staggered teardown, five readable components, then the exact reverse assembly. */
export function transparentMachineState(seconds: number) {
  const time = Math.max(0, Math.min(MACHINE_FILM_SECONDS, Number.isFinite(seconds) ? seconds : 0));
  const phase = Math.floor((time - 7) / 4);
  const selected = phase >= 0 && phase < PHONE_FOCUS_ORDER.length ? PHONE_FOCUS_ORDER[phase] : null;
  const localTime = selected ? time - 7 - phase * 4 : 0;
  const focus = selected ? smooth(0, .8, localTime) * (1 - smooth(2.8, 4, localTime)) : 0;
  const openings = Object.fromEntries(MACHINE_PART_IDS.map((id, index) => [id,
    openEase(2.4 + index * .09, 4.4 + index * .09, time)
      * (1 - smooth(29 + (4 - index) * .12, 32.5 + (4 - index) * .12, time)),
  ])) as Record<MachinePartId, number>;
  return { time, selected, localTime, focus, openings,
    assemblyOpen: Math.max(...Object.values(openings)),
    presence: smooth(0, 1.25, time) * (1 - smooth(34.5, 36, time)),
    readout: selected ? smooth(.4, 1, localTime) * (1 - smooth(3, 4, localTime)) : 0,
  };
}
export type TransparentMachineState = ReturnType<typeof transparentMachineState>;

export function machineLayerCentre(layer: MachineLayer, state: TransparentMachineState): HoloPoint {
  const amount = state.openings[layer], a = PHONE_CLOSED_CENTRES[layer], b = OPEN_CENTRES[layer];
  const focus = state.selected === layer ? state.focus : 0;
  // Slide internal modules aside before approaching; the same curve retracts
  // them behind the glass first on reassembly, avoiding early glass intersections.
  const depthAmount = layer === 'camera' || layer === 'battery' ? smooth(.45, 1, amount) : amount;
  return { x: mix(a.x, b.x, amount), y: mix(a.y, b.y, amount),
    z: mix(a.z, b.z, depthAmount) - focus * 48 };
}
export function machineLayerScale(layer: MachineLayer, state: TransparentMachineState) {
  return 1 + (state.selected === layer ? state.focus : 0) * .085;
}
/** Parallel handset layers occlude by their plane, not by the camera depth of unequal-sized centres. */
export function machineDrawOrder(state: TransparentMachineState): MachineLayer[] {
  return [...MACHINE_PART_IDS].sort((a, b) => machineLayerCentre(b, state).z - machineLayerCentre(a, state).z);
}
export function machineLayerPoint(layer: MachineLayer, point: HoloPoint, state: TransparentMachineState): HoloPoint {
  const center = machineLayerCentre(layer, state), scale = machineLayerScale(layer, state);
  return { x: center.x + point.x * scale, y: center.y + point.y * scale, z: center.z + point.z * scale };
}
export function machinePartCentre(id: MachinePartId, state: TransparentMachineState): HoloPoint {
  return machineLayerPoint(id, id === 'board' ? PHONE_CPU_ANCHOR : { x: 0, y: 0, z: 0 }, state);
}
export function machineProjection(state: TransparentMachineState) {
  return createHoloProjection({ x: 640, y: 346, yaw: -.38 - state.assemblyOpen * .035 + Math.sin(state.time * .10) * .014,
    pitch: .055, scale: .89, distance: 1600 });
}
export function machineMetricValid(metric: MachineMetric) {
  return !!metric && typeof metric.label === 'string' && !!metric.label.trim()
    && typeof metric.unit === 'string' && !!metric.unit.trim()
    && Number.isFinite(metric.value) && metric.value >= 0 && Number.isFinite(metric.max) && metric.max > 0
    && (metric.warningAbove === undefined || Number.isFinite(metric.warningAbove) && metric.warningAbove >= 0)
    && (metric.decimals === undefined || Number.isInteger(metric.decimals) && metric.decimals >= 0 && metric.decimals <= 6);
}
export function machineReadingWarning(reading: MachineReading) {
  return !reading || typeof reading.name !== 'string' || !reading.name.trim()
    || !Array.isArray(reading.metrics)
    || Array.from(reading.metrics).some(metric => !machineMetricValid(metric)
      || metric.warningAbove !== undefined && metric.value >= metric.warningAbove);
}
