import { smooth } from './filmDrawing';
import { focusEnvelope } from './filmFocus';
import { SMT_STATIONS, SMT_LINE_WIDTH } from './smtLine';
import { projectInspectionPoint, type InspectionCamera } from './inspectionSpace';

export const SMT_FACTORY_LINES = 5;
export const SMT_FACTORY_PITCH = 480;
export const SMT_FACTORY_DEPTH = 130;
export const SMT_FACTORY_STATIONS = Array.from({ length: SMT_FACTORY_LINES }, (_, line) =>
  SMT_STATIONS.map(station => ({ ...station, line: line + 1, z: line * SMT_FACTORY_PITCH,
    key: `L${line + 1}-${station.id}` }))).flat();
export const SMT_FACTORY_STOPS = [
  { line: 1, id: 'reflow', kind: 'thermal', title: '리플로우 냉각부' },
  { line: 3, id: 'maoi', kind: 'quality', title: '실장 후 광학검사' },
  { line: 5, id: 'mounter', kind: 'production', title: '부품 실장 실적' },
] as const;
export const SMT_FACTORY_SECONDS = 64;
export type FactoryPoint = { x: number; y: number; z: number };
export type FactoryStation = typeof SMT_FACTORY_STATIONS[number];

export function smtFactoryState(seconds: number) {
  const time = Math.max(0, Math.min(SMT_FACTORY_SECONDS, Number.isFinite(seconds) ? seconds : 0));
  const index = Math.min(2, Math.floor(time / 16));
  const localTime = Math.min(time, 46) - index * 16;
  const overview = smooth(46, 50, time);
  const stop = SMT_FACTORY_STOPS[index];
  const station = SMT_FACTORY_STATIONS.find(item => item.line === stop.line && item.id === stop.id)!;
  const nextStop=SMT_FACTORY_STOPS[Math.min(2,index+1)];
  const next=SMT_FACTORY_STATIONS.find(item=>item.line===nextStop.line&&item.id===nextStop.id)!;
  // Hold at the upstream entrance, move into the aisle, then advance along PCB flow.
  // Return to the entrance before changing lines, so no segment crosses a machine.
  const inAisle=smooth(3,4,localTime)*(1-smooth(14,14.7,localTime));
  const advance=smooth(4,6,localTime)*(1-smooth(12,14,localTime));
  const changeLine=smooth(14.7,16,localTime);
  return { time, index, localTime, stop, station, overview,
    cameraX:-440+(station.x-station.width/2-420+440)*advance,
    cameraZ:station.z-SMT_FACTORY_DEPTH/2+220*inAisle+(next.z-station.z)*changeLine,
    focus: focusEnvelope(localTime, { enter: [4, 6], exit: [12, 14] }),
    readout: smooth(6, 7, localTime) * (1 - smooth(11.3, 12, localTime)),
    presence: smooth(0, 1.1, time) * (1 - smooth(63, 64, time)),
  };
}
export type FactoryState = ReturnType<typeof smtFactoryState> & {
  cameraOverride?: InspectionCamera;
  /** undefined follows the tour; null means manual navigation without a selection. */
  manualSelection?: string | null;
};

/** The entrance faces downstream (+process x), not across the equipment's operator side. */
export function factoryCamera(state:FactoryState):InspectionCamera {
  if (state.cameraOverride) return state.cameraOverride;
  const aisle = {x:state.cameraZ,y:220,z:state.cameraX,
    yaw:-.12*state.focus,pitch:.14+.10*state.focus,focal:720,near:35};
  if (state.overview <= 0) return aisle;
  const yaw = smooth(50, 62, state.time) * Math.PI * 2;
  const pitch = 1.02, distance = Math.max(3500, SMT_LINE_WIDTH * 1.8);
  const centerX = (SMT_FACTORY_LINES - 1) * SMT_FACTORY_PITCH / 2 - SMT_FACTORY_DEPTH / 2;
  const centerZ = SMT_LINE_WIDTH / 2;
  const bird = { x: centerX - Math.sin(yaw) * Math.cos(pitch) * distance,
    y: 70 + Math.sin(pitch) * distance, z: centerZ - Math.cos(yaw) * Math.cos(pitch) * distance,
    yaw, pitch, focal: 720, near: 35 };
  const blend = (a: number, b: number) => a + (b - a) * state.overview;
  return { x: blend(aisle.x, bird.x), y: blend(aisle.y, bird.y), z: blend(aisle.z, bird.z),
    yaw: blend(aisle.yaw, bird.yaw), pitch: blend(aisle.pitch, bird.pitch), focal: 720, near: 35 };
}
export const factoryWorld=(point:FactoryPoint)=>({x:point.z,y:point.y,z:point.x});
export function factoryProject(point: FactoryPoint, state: FactoryState) {
  return projectInspectionPoint(factoryCamera(state),factoryWorld(point));
}
export function factoryTarget(state: FactoryState) {
  const s = state.station;
  const corners = [-1, 1].flatMap(side => [0, s.height + 45].flatMap(y => [s.z - SMT_FACTORY_DEPTH, s.z]
    .map(z => factoryProject({ x: s.x + side * (s.width / 2 + 10), y, z }, state))));
  const left = Math.min(...corners.map(p => p.x)), right = Math.max(...corners.map(p => p.x));
  const top = Math.min(...corners.map(p => p.y)), bottom = Math.max(...corners.map(p => p.y));
  return { x: (left + right) / 2, y: (top + bottom) / 2, width: right - left + 10, height: bottom - top + 10 };
}
