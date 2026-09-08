import { smooth } from './filmDrawing';
import { focusEnvelope } from './filmFocus';
import { SMT_STATIONS } from './smtLine';
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
export const SMT_FACTORY_SECONDS = 48;
export type FactoryPoint = { x: number; y: number; z: number };
export type FactoryStation = typeof SMT_FACTORY_STATIONS[number];

export function smtFactoryState(seconds: number) {
  const time = Math.max(0, Math.min(SMT_FACTORY_SECONDS, Number.isFinite(seconds) ? seconds : 0));
  const index = Math.min(2, Math.floor(time / 16));
  const localTime = time - index * 16;
  const stop = SMT_FACTORY_STOPS[index];
  const station = SMT_FACTORY_STATIONS.find(item => item.line === stop.line && item.id === stop.id)!;
  const nextStop=SMT_FACTORY_STOPS[Math.min(2,index+1)];
  const next=SMT_FACTORY_STATIONS.find(item=>item.line===nextStop.line&&item.id===nextStop.id)!;
  // Hold at the upstream entrance, move into the aisle, then advance along PCB flow.
  // Return to the entrance before changing lines, so no segment crosses a machine.
  const inAisle=smooth(3,4,localTime)*(1-smooth(14,14.7,localTime));
  const advance=smooth(4,6,localTime)*(1-smooth(12,14,localTime));
  const changeLine=smooth(14.7,16,localTime);
  return { time, index, localTime, stop, station,
    cameraX:-440+(station.x-station.width/2-420+440)*advance,
    cameraZ:station.z-SMT_FACTORY_DEPTH/2+220*inAisle+(next.z-station.z)*changeLine,
    focus: focusEnvelope(localTime, { enter: [4, 6], exit: [12, 14] }),
    readout: smooth(6, 7, localTime) * (1 - smooth(11.3, 12, localTime)),
    presence: smooth(0, 1.1, time) * (1 - smooth(47, 48, time)),
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
  return {x:state.cameraZ,y:220,z:state.cameraX,
    yaw:-.12*state.focus,pitch:.14+.10*state.focus,focal:720,near:35};
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
