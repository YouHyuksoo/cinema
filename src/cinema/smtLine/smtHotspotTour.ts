import { smooth } from '../filmDrawing';
import { environmentHeatmap } from '../environmentHeatmap';
import { ENVIRONMENT_HOTSPOT_DWELL, environmentHotspotOrder } from '../environmentHeatmapProjection';
import { ENVIRONMENT_FILM_SECONDS, ENVIRONMENT_TIMING, type EnvironmentZone } from '../zoneEnvironment';

/**
 * SMT 3D 공간에서 온도가 높은 구역을 순서대로 날아가 보는 연출(Round 3-2). 2D 히트맵이 끄면서
 * 함께 사라졌던 `environmentHeatmapProjection.ts` 의 비행 스케줄(순서·타이밍)을 그대로 옮긴다 —
 * 온도 높은 순, 구역당 `ENVIRONMENT_HOTSPOT_DWELL`(4.8초): 1.4초 진입 → 2.2초 판독 → 1.2초 후퇴.
 * 좌표계만 다르다: 2D는 히트맵 bounds 기준, 여기는 76×44m 월드 좌표(SMT 5×2 격자 핀).
 * three.js 에 의존하지 않는 순수 계산이라 노드 테스트에서 그대로 검증된다. 어느 구역을 몇 번째로
 * 도는지(순서 자체)는 이 파일이 정하지 않는다 — 호출부가 `environmentHotspotOrder`(같은 2D 파일)로
 * 정렬한 목록을 넘긴다; 여기서는 그 순서를 그대로 따르는 시간표와 3D 포즈만 만든다.
 */
export interface SmtHotspotEntry { id: string; name: string; temperature: number; x: number; z: number }
export interface SmtHotspotPose { position: readonly [number, number, number]; target: readonly [number, number, number] }
export interface SmtHotspotFrame {
  touring: boolean; returning: boolean; retreating: boolean;
  active: SmtHotspotEntry | null; rank: number; total: number; phase: string; pose: SmtHotspotPose;
}

/** 진입 1.4초 + 판독 2.2초 = 3.6초, 그 뒤 1.2초 후퇴로 DWELL(4.8초)을 채운다. */
const ENTER_END = 1.4;
const READ_END = 3.6;
const RETURN_DURATION = 3;
/** 대각선 위에서 내려다보되 설비 눈높이에 가깝게 접근한다(판독 시점). */
const STOP_OFFSET = { x: 9, y: 8.5, z: 9 };
/** 후퇴 시 같은 대상을 바라본 채 더 높고 더 멀리 물러난다. */
const EXIT_OFFSET = { x: 9, y: 15, z: 18 };
const SENSOR_EYE_HEIGHT = .6;

function hotspotStopPose(entry: SmtHotspotEntry): SmtHotspotPose {
  return { position: [entry.x + STOP_OFFSET.x, STOP_OFFSET.y, entry.z + STOP_OFFSET.z],
    target: [entry.x, SENSOR_EYE_HEIGHT, entry.z] };
}
function hotspotExitPose(entry: SmtHotspotEntry): SmtHotspotPose {
  return { position: [entry.x + EXIT_OFFSET.x, EXIT_OFFSET.y, entry.z + EXIT_OFFSET.z],
    target: [entry.x, SENSOR_EYE_HEIGHT, entry.z] };
}
function mix3(a: readonly [number, number, number], b: readonly [number, number, number], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
function mixPose(from: SmtHotspotPose, to: SmtHotspotPose, t: number): SmtHotspotPose {
  return { position: mix3(from.position, to.position, t), target: mix3(from.target, to.target, t) };
}

/** 온도 높은 순 정렬은 `environmentHotspotOrder`(2D 히트맵과 같은 규칙)를 그대로 쓰고, 여기서는
 * 그 순서에 우리 3D 핀 좌표(x,z)만 붙인다 — 정렬 로직을 새로 만들지 않는다. three.js 에 의존하지
 * 않아 노드 테스트에서 온도 변화가 순서를 바꾸는지 그대로 검증할 수 있다. */
export function smtHotspotOrder(zones: readonly EnvironmentZone[],
  pins: readonly { id: string; x: number; z: number }[]): SmtHotspotEntry[] {
  const ordered = environmentHotspotOrder(environmentHeatmap(zones).rooms);
  const entries: SmtHotspotEntry[] = [];
  for (const room of ordered) {
    const pin = pins.find(item => item.id === room.zone.id);
    if (pin) entries.push({ id: room.zone.id, name: room.zone.name, temperature: room.temperature!, x: pin.x, z: pin.z });
  }
  return entries;
}

/**
 * `ordered` 는 이미 온도 높은 순으로 정렬된 목록이다(`smtHotspotOrder` 로 만든다). `overview` 는
 * 순회 시작 전/종료 후 머무는 상공 포즈다.
 */
export function smtHotspotTour(elapsed: number, ordered: readonly SmtHotspotEntry[], overview: SmtHotspotPose): SmtHotspotFrame {
  const time = Number.isFinite(elapsed)
    ? Math.max(ENVIRONMENT_TIMING.heatmapStart, Math.min(ENVIRONMENT_FILM_SECONDS, elapsed))
    : ENVIRONMENT_TIMING.heatmapStart;
  const tourTime = Math.max(0, time - ENVIRONMENT_TIMING.heatmapFull);
  const index = Math.floor(tourTime / ENVIRONMENT_HOTSPOT_DWELL);
  const touring = time > ENVIRONMENT_TIMING.heatmapFull && index < ordered.length;
  const returning = ordered.length > 0 && index >= ordered.length;
  const active = touring ? ordered[index] : null;
  const local = tourTime - index * ENVIRONMENT_HOTSPOT_DWELL;
  const retreating = !!active && local >= READ_END;
  const from = retreating ? hotspotStopPose(active!)
    : touring && index > 0 ? hotspotExitPose(ordered[index - 1])
    : returning ? hotspotExitPose(ordered[ordered.length - 1])
    : overview;
  const to = active ? (retreating ? hotspotExitPose(active) : hotspotStopPose(active)) : overview;
  const progress = retreating ? smooth(READ_END, ENVIRONMENT_HOTSPOT_DWELL, local)
    : touring ? smooth(0, ENTER_END, local)
    : returning ? smooth(0, RETURN_DURATION, tourTime - ordered.length * ENVIRONMENT_HOTSPOT_DWELL)
    : 1;
  return {
    touring, returning, retreating, active, rank: touring ? index + 1 : 0, total: ordered.length,
    phase: retreating ? '뒤로 빠지며 완만하게 상승'
      : touring ? (progress < 1 ? '완만하게 센서 옆으로 진입' : '측면에서 온도 확인')
      : returning ? '상공 복귀' : '상공 평면',
    pose: mixPose(from, to, progress),
  };
}
