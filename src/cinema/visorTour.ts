import { smooth } from './filmDrawing';
import { focusEnvelope } from './filmFocus';
import { INSPECTION_STATIONS, inspectionCamera, type InspectionCamera } from './inspectionSpace';

export const VISOR_TOUR_STOPS = [
  { stationId: 3, kind: 'thermal', title: '열원 · 냉각 상태', format: '박스형 정보', phase: '열원 위치와 냉각 상태를 확인합니다.' },
  { stationId: 4, kind: 'quality', title: '검사 · 품질 상태', format: '원형 지표', phase: '검사 결과가 원형 지표로 펼쳐집니다.' },
  { stationId: 1, kind: 'production', title: '시간대별 생산 실적', format: '가로 막대', phase: '시간대별 실적을 목표와 비교합니다.' },
] as const;

export const VISOR_STOP_SECONDS = 16;
export const VISOR_TOUR_SECONDS = VISOR_STOP_SECONDS * VISOR_TOUR_STOPS.length;

/** One seekable clock owns the selected machine, optical focus and its annotation. */
export function visorTourState(time: number) {
  const elapsed = Math.max(0, Math.min(VISOR_TOUR_SECONDS, Number.isFinite(time) ? time : 0));
  const index = Math.min(VISOR_TOUR_STOPS.length - 1, Math.floor(elapsed / VISOR_STOP_SECONDS));
  const stop = VISOR_TOUR_STOPS[index];
  const localTime = elapsed - index * VISOR_STOP_SECONDS;
  const station = INSPECTION_STATIONS.find(item => item.id === stop.stationId)!;
  const focus = focusEnvelope(localTime, { enter: [1.7, 5], exit: [12.5, 15.2] });
  const readout = smooth(4.7, 5.7, localTime) * (1 - smooth(11.3, 12.5, localTime));
  const lock = smooth(.5, 1.8, localTime) * (1 - smooth(14.4, 15.6, localTime));
  const heat = stop.kind === 'thermal' ? smooth(3.5, 5.2, localTime) * (1 - smooth(13.5, 15.3, localTime)) : 0;
  return { stop, station, index, localTime, focus, readout, lock, heat,
    readoutTime: localTime - 4.7,
    reveal: smooth(.1, 1.2, elapsed) * (1 - smooth(VISOR_TOUR_SECONDS - 1, VISOR_TOUR_SECONDS, elapsed)),
  };
}

/** Each inspection returns to the shared aisle before approaching the next real station. */
export function visorTourCamera(time: number): InspectionCamera {
  const { station, focus } = visorTourState(time);
  const wide = { ...inspectionCamera(time, 0), x: 108 + Math.sin(time * .17) * 14, yaw: -.03 };
  const mix = (a: number, b: number) => a + (b - a) * focus;
  return {
    ...wide,
    x: mix(wide.x, station.x + 94),
    y: mix(wide.y, 210),
    z: mix(wide.z, station.z - 460),
    yaw: mix(wide.yaw, -.012),
    pitch: mix(wide.pitch, .272),
  };
}
