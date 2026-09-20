import { DEFAULT_ENVIRONMENT_DATA } from '../zoneEnvironment';

export interface Vec3 { x: number; y: number; z: number }
/** 축에 정렬된 직사각형 구역. 경계가 곧 내벽 위치다. */
export interface StageRoom { id: string; name: string; x0: number; z0: number; x1: number; z1: number }
/** 벽 시작점에서 `at` 만큼 떨어진 곳에 뚫는 문·창. `y0`~`y1` 이 높이 구간이다. */
export interface WallOpening { at: number; width: number; y0: number; y1: number; glass?: boolean }
export interface WallSegment {
  x0: number; z0: number; x1: number; z1: number;
  height: number; kind: 'outer' | 'inner'; openings: readonly WallOpening[];
}

export const STAGE_WIDTH = 60;
export const STAGE_DEPTH = 40;
export const STAGE_WALL_HEIGHT = 4.2;
export const STAGE_WALL_THICKNESS = .35;
/** 뒤·앞 두 띠 사이를 지나는 중앙 통로. 카메라가 구역 사이를 끊지 않고 이동하는 길이다. */
const CORRIDOR = { z0: 18, z1: 22 } as const;
const BAND_DEPTH = 18;
const BAY = STAGE_WIDTH / 5;

/**
 * SMT 공정 흐름을 U 자로 편다. 뒤 띠를 왼쪽에서 오른쪽으로 지나 앞 띠를 오른쪽에서 왼쪽으로 되돌아온다:
 * 입고 → 보관 → 인쇄 → 실장 → 리플로우 → 검사 → 조립 → 검사 대기 → 포장 → 완제품.
 * 구역 순서와 이름은 온습도 데이터가 정하므로 여기서 새로 짓지 않는다.
 */
export const STAGE_ROOMS: readonly StageRoom[] = DEFAULT_ENVIRONMENT_DATA.zones.map((zone, index) => {
  const back = index < 5;
  const bay = back ? index : 9 - index;
  return {
    id: zone.id, name: zone.name,
    x0: bay * BAY, x1: (bay + 1) * BAY,
    z0: back ? 0 : CORRIDOR.z1, z1: back ? BAND_DEPTH : CORRIDOR.z1 + BAND_DEPTH,
  };
});

export function roomCenter(room: StageRoom): Vec3 {
  return { x: (room.x0 + room.x1) / 2, y: 0, z: (room.z0 + room.z1) / 2 };
}
export function roomArea(room: StageRoom): number {
  return (room.x1 - room.x0) * (room.z1 - room.z0);
}
export function roomById(id: string): StageRoom | null {
  return STAGE_ROOMS.find(room => room.id === id) ?? null;
}

/** 센서는 구역 중앙 천장 아래에 매단다. 카드가 설비에 가리지 않도록 사람 키보다 조금 위다. */
export function sensorAnchor(index: number): Vec3 | null {
  const room = STAGE_ROOMS[index];
  if (!room) return null;
  const center = roomCenter(room);
  return { x: center.x, y: 2.6, z: center.z };
}

const door = (at: number): WallOpening => ({ at, width: 1.6, y0: 0, y1: 2.4 });
const window_ = (at: number): WallOpening => ({ at, width: 3.4, y0: 1.1, y1: 2.9, glass: true });

function outer(x0: number, z0: number, x1: number, z1: number, openings: WallOpening[] = []): WallSegment {
  return { x0, z0, x1, z1, height: STAGE_WALL_HEIGHT, kind: 'outer', openings };
}
function inner(x0: number, z0: number, x1: number, z1: number, openings: WallOpening[]): WallSegment {
  return { x0, z0, x1, z1, height: STAGE_WALL_HEIGHT, kind: 'inner', openings };
}

/** 뒤 띠와 앞 띠의 구역 사이 칸막이. 각 칸막이에는 통행문을 하나 둔다. */
const partitions: WallSegment[] = [];
for (let bay = 1; bay < 5; bay++) {
  partitions.push(inner(bay * BAY, 0, bay * BAY, BAND_DEPTH, [door(BAND_DEPTH / 2 - .8)]));
  partitions.push(inner(bay * BAY, CORRIDOR.z1, bay * BAY, CORRIDOR.z1 + BAND_DEPTH, [door(BAND_DEPTH / 2 - .8)]));
}
/** 통로에 면한 벽. 구역마다 통로로 나오는 문을 하나씩 둔다. */
const corridorDoors = (z: number) => inner(0, z, STAGE_WIDTH, z,
  STAGE_ROOMS.slice(0, 5).map((_, bay) => door(bay * BAY + BAY / 2 - .8)));

export const STAGE_WALLS: readonly WallSegment[] = [
  outer(0, 0, STAGE_WIDTH, 0),
  outer(0, 0, 0, STAGE_DEPTH, [window_(26), window_(31), window_(36)]),
  outer(STAGE_WIDTH, 0, STAGE_WIDTH, STAGE_DEPTH, [window_(6), window_(11)]),
  outer(0, STAGE_DEPTH, STAGE_WIDTH, STAGE_DEPTH, [
    { at: 8, width: 4, y0: 0, y1: 3, glass: true },
    window_(20), window_(30), window_(40),
  ]),
  corridorDoors(CORRIDOR.z0),
  corridorDoors(CORRIDOR.z1),
  ...partitions,
];
