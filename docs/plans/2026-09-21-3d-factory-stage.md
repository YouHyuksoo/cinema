# 3D 공장 무대 구현 계획

> **작업자 안내:** 이 계획은 `superpowers:subagent-driven-development` 또는 `superpowers:executing-plans` 로 태스크 단위 실행한다. 각 단계는 체크박스(`- [ ]`)로 추적한다.

**목표:** 필름 전체의 배경을 실제 3D 공장으로 바꾸고, 공간 챕터의 카메라 연출과 온도 히트맵을 그 위에서 수행한다.

**구조:** three.js 씬을 오프스크린 캔버스에 그리고, 필름 캔버스가 그것을 배경으로 받아 그린다. 기존 장면 HUD가 그 위에 얹히고 질감·블룸이 전체에 한 번 걸린다. 순수 계산(배치·카메라·투영)은 three.js 없이 테스트한다.

**기술:** Next.js 16.3.4, React 19.2.8, three 0.186.0, vitest, TypeScript

**설계서:** `docs/specs/2026-09-21-3d-factory-stage-design.md`

## 전역 제약

- 좌표 단위는 미터. X가 긴 변(0→60), Z가 짧은 변(0→40), Y가 높이. 건물 `60 × 40`, 벽 높이 `4.2`, 벽 두께 `0.35`.
- 온습도 구역은 10개이며 이름과 순서는 `zoneEnvironment.ts` 의 기본 데이터를 따른다: 자재 입고, 자재 보관, 인쇄 공정, 실장 공정, 리플로우, 검사 공정, 조립 공정, 검사 대기, 포장 공정, 완제품 보관.
- 구역 id 는 `ZONE 01` ~ `ZONE 10` 형식이며 `pad2` 로 만든다. 3D 쪽에서 새 id 체계를 만들지 않는다.
- 상태 판정은 `environmentZoneStatus` 만 쓴다. 새 임계값을 만들지 않는다.
- 숫자는 `sceneData.environment` 에서만 온다. 3D 도입이 데이터 출처를 바꾸지 않는다.
- three.js 는 반드시 동적 `import()` 로 불러온다. 정적 import 하면 초기 번들에 1MB 가 들어간다.
- 테스트는 `tests/unit/scenes/` 에 두고 `@/cinema/...` 경로로 import 한다.
- 새 프레임 루프를 만들지 않는다. 기존 `useFilmPlayback` 의 루프 안에서 동작한다.

---

## 1단계 · 합성 배관

### Task 1: 무대 배치 데이터

**파일:**
- 생성: `src/cinema/stage/factoryLayout.ts`
- 테스트: `tests/unit/scenes/cinemaStageLayout.test.ts`

**인터페이스:**
- 제공: `Vec3`, `StageRoom`, `WallOpening`, `WallSegment`, `STAGE_WIDTH`, `STAGE_DEPTH`, `STAGE_WALL_HEIGHT`, `STAGE_WALL_THICKNESS`, `STAGE_ROOMS`, `STAGE_WALLS`, `roomCenter`, `roomArea`, `roomById`, `sensorAnchor`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// tests/unit/scenes/cinemaStageLayout.test.ts
import { describe, expect, it } from 'vitest';
import {
  STAGE_ROOMS, STAGE_WALLS, STAGE_WIDTH, STAGE_DEPTH,
  roomArea, roomById, roomCenter, sensorAnchor,
} from '@/cinema/stage/factoryLayout';
import { DEFAULT_ENVIRONMENT_DATA } from '@/cinema/zoneEnvironment';

describe('무대 배치', () => {
  it('구역 10개가 온습도 데이터와 같은 id·이름을 쓴다', () => {
    expect(STAGE_ROOMS).toHaveLength(10);
    expect(STAGE_ROOMS.map(room => room.id)).toEqual(DEFAULT_ENVIRONMENT_DATA.zones.map(zone => zone.id));
    expect(STAGE_ROOMS.map(room => room.name)).toEqual(DEFAULT_ENVIRONMENT_DATA.zones.map(zone => zone.name));
  });

  it('모든 방이 건물 안에 있고 서로 겹치지 않는다', () => {
    for (const room of STAGE_ROOMS) {
      expect(room.x0).toBeGreaterThanOrEqual(0);
      expect(room.z0).toBeGreaterThanOrEqual(0);
      expect(room.x1).toBeLessThanOrEqual(STAGE_WIDTH);
      expect(room.z1).toBeLessThanOrEqual(STAGE_DEPTH);
      expect(room.x1).toBeGreaterThan(room.x0);
      expect(room.z1).toBeGreaterThan(room.z0);
    }
    for (const a of STAGE_ROOMS) for (const b of STAGE_ROOMS) {
      if (a.id === b.id) continue;
      const overlap = a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1;
      expect(overlap, `${a.id} 와 ${b.id} 가 겹친다`).toBe(false);
    }
  });

  it('방 중심과 면적을 계산한다', () => {
    const first = STAGE_ROOMS[0];
    expect(roomCenter(first)).toEqual({ x: (first.x0 + first.x1) / 2, y: 0, z: (first.z0 + first.z1) / 2 });
    expect(roomArea(first)).toBe((first.x1 - first.x0) * (first.z1 - first.z0));
    expect(roomById('ZONE 01')?.name).toBe('자재 입고');
    expect(roomById('없는 구역')).toBeNull();
  });

  it('모든 내벽에 통행 개구부가 있다', () => {
    const inner = STAGE_WALLS.filter(wall => wall.kind === 'inner');
    expect(inner.length).toBeGreaterThan(0);
    for (const wall of inner) expect(wall.openings.length, `${wall.x0},${wall.z0} 벽에 문이 없다`).toBeGreaterThan(0);
  });

  it('개구부가 벽 길이를 넘지 않고 서로 겹치지 않는다', () => {
    for (const wall of STAGE_WALLS) {
      const length = Math.hypot(wall.x1 - wall.x0, wall.z1 - wall.z0);
      const sorted = [...wall.openings].sort((a, b) => a.at - b.at);
      let cursor = 0;
      for (const opening of sorted) {
        expect(opening.at).toBeGreaterThanOrEqual(cursor);
        expect(opening.at + opening.width).toBeLessThanOrEqual(length);
        expect(opening.y1).toBeGreaterThan(opening.y0);
        cursor = opening.at + opening.width;
      }
    }
  });

  it('센서 위치는 해당 구역 안, 사람 키 높이에 있다', () => {
    STAGE_ROOMS.forEach((room, index) => {
      const anchor = sensorAnchor(index);
      expect(anchor.x).toBeGreaterThan(room.x0);
      expect(anchor.x).toBeLessThan(room.x1);
      expect(anchor.z).toBeGreaterThan(room.z0);
      expect(anchor.z).toBeLessThan(room.z1);
      expect(anchor.y).toBeCloseTo(2.6);
    });
    expect(sensorAnchor(99)).toBeNull();
  });
});
```

- [ ] **Step 2: 실패 확인**

실행: `npx vitest run tests/unit/scenes/cinemaStageLayout.test.ts`
예상: FAIL — `Cannot find module '@/cinema/stage/factoryLayout'`

- [ ] **Step 3: 구현**

```ts
// src/cinema/stage/factoryLayout.ts
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
```

- [ ] **Step 4: 통과 확인**

실행: `npx vitest run tests/unit/scenes/cinemaStageLayout.test.ts`
예상: PASS (6 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/cinema/stage/factoryLayout.ts tests/unit/scenes/cinemaStageLayout.test.ts
git commit -m "feat(cinema): 3D 무대 구역·벽 배치 데이터"
```

---

### Task 2: 프레임 게이트에 카메라 포즈 추가

**파일:**
- 수정: `src/cinema/filmFrameGate.ts`
- 테스트: `tests/unit/scenes/cinemaStageFrameGate.test.ts`

**인터페이스:**
- 사용: 없음
- 제공: `FilmFrameKey.stagePose: string | null`

카메라가 움직이면 다시 그려야 하고, 멈춰 있으면 기존 규칙대로 건너뛴다. 포즈 객체를 매 프레임 새로 만들므로 identity 비교로는 항상 달라진다. 문자열 서명으로 비교한다.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// tests/unit/scenes/cinemaStageFrameGate.test.ts
import { describe, expect, it } from 'vitest';
import { filmFrameChanged, type FilmFrameKey } from '@/cinema/filmFrameGate';
import { DEFAULT_FILM_TEXTURE } from '@/cinema/filmTexture';
import { DEFAULT_FILM_CHARTS } from '@/cinema/chartPresentation';
import { DEFAULT_FILM_THEME } from '@/cinema/filmThemes';
import { DEFAULT_MACHINE_SUBJECT } from '@/cinema/machinePresentation';

const base: FilmFrameKey = {
  camera: false, time: 12, width: 800, height: 450, inset: 0,
  theme: DEFAULT_FILM_THEME, texture: DEFAULT_FILM_TEXTURE, charts: DEFAULT_FILM_CHARTS,
  subject: DEFAULT_MACHINE_SUBJECT, factory: null, cctvManual: false,
  selectedZone: null, data: null, provenance: null, stagePose: 'a',
};

describe('무대 포즈와 프레임 게이트', () => {
  it('포즈가 같으면 다시 그리지 않는다', () => {
    expect(filmFrameChanged(base, { ...base })).toBe(false);
  });
  it('포즈가 바뀌면 다시 그린다', () => {
    expect(filmFrameChanged(base, { ...base, stagePose: 'b' })).toBe(true);
  });
  it('무대가 없는 상태끼리도 다시 그리지 않는다', () => {
    const off = { ...base, stagePose: null };
    expect(filmFrameChanged(off, { ...off })).toBe(false);
  });
});
```

- [ ] **Step 2: 실패 확인**

실행: `npx vitest run tests/unit/scenes/cinemaStageFrameGate.test.ts`
예상: FAIL — `stagePose` 가 `FilmFrameKey` 에 없다는 타입 오류

- [ ] **Step 3: 구현**

`src/cinema/filmFrameGate.ts` 의 `FilmFrameKey` 에 필드를 더한다.

```ts
export interface FilmFrameKey {
  camera: boolean; time: number; width: number; height: number; inset: number;
  theme: FilmThemeId; texture: FilmTextureSettings; charts: FilmChartSettings; subject: MachineSubject;
  factory: unknown; cctvManual: boolean; selectedZone: string | null; data: unknown; provenance: unknown;
  /** 무대 카메라 포즈의 문자열 서명. 무대가 꺼져 있으면 null. 포즈 객체는 매 프레임 새로 만들어져 identity 비교가 통하지 않는다. */
  stagePose: string | null;
}
```

`filmFrameChanged` 의 비교식 마지막에 한 항을 더한다.

```ts
    || previous.data !== next.data || previous.provenance !== next.provenance
    || previous.stagePose !== next.stagePose;
```

- [ ] **Step 4: 통과 확인**

실행: `npx vitest run tests/unit/scenes/cinemaStageFrameGate.test.ts && npx tsc --noEmit --incremental false`
예상: 테스트 PASS. 타입 검사는 `useFilmPlayback.ts` 에서 `stagePose` 누락 오류가 난다 — Task 5 에서 채운다. 이 단계에서는 `useFilmPlayback.ts` 의 key 생성에 `stagePose: null` 만 임시로 넣어 타입을 통과시킨다.

- [ ] **Step 5: 커밋**

```bash
git add src/cinema/filmFrameGate.ts src/cinema/useFilmPlayback.ts tests/unit/scenes/cinemaStageFrameGate.test.ts
git commit -m "feat(cinema): 프레임 게이트에 무대 카메라 포즈 추가"
```

---

### Task 3: 챕터 카메라

**파일:**
- 생성: `src/cinema/stage/stageCamera.ts`
- 테스트: `tests/unit/scenes/cinemaStageCamera.test.ts`

**인터페이스:**
- 사용: Task 1 의 `Vec3`, `STAGE_ROOMS`, `roomCenter`, `STAGE_WIDTH`, `STAGE_DEPTH`
- 제공: `StagePose`, `STAGE_CHAPTERS`, `isStageChapter`, `stagePose`, `poseSignature`, `lerpPose`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// tests/unit/scenes/cinemaStageCamera.test.ts
import { describe, expect, it } from 'vitest';
import { isStageChapter, poseSignature, stagePose, STAGE_CHAPTERS } from '@/cinema/stage/stageCamera';
import { STAGE_DEPTH, STAGE_WIDTH } from '@/cinema/stage/factoryLayout';

describe('무대 카메라', () => {
  it('공간 챕터만 연출을 받는다', () => {
    expect([...STAGE_CHAPTERS]).toEqual(['wave', 'visor', 'visorPan']);
    expect(isStageChapter('wave')).toBe(true);
    expect(isStageChapter('pie')).toBe(false);
  });

  it('공간 챕터는 시간에 따라 카메라가 움직인다', () => {
    const start = stagePose('visor', 0, 64);
    const end = stagePose('visor', 64, 64);
    expect(poseSignature(start)).not.toBe(poseSignature(end));
  });

  it('공간 챕터가 아니면 포즈가 시간과 무관하게 고정된다', () => {
    expect(poseSignature(stagePose('pie', 0, 28))).toBe(poseSignature(stagePose('pie', 27, 28)));
  });

  it('카메라와 시선이 건물 주변을 벗어나지 않는다', () => {
    for (const chapter of STAGE_CHAPTERS) {
      for (const t of [0, .25, .5, .75, 1]) {
        const pose = stagePose(chapter, t * 40, 40);
        expect(pose.target.x).toBeGreaterThan(-STAGE_WIDTH);
        expect(pose.target.x).toBeLessThan(STAGE_WIDTH * 2);
        expect(pose.target.z).toBeGreaterThan(-STAGE_DEPTH);
        expect(pose.target.z).toBeLessThan(STAGE_DEPTH * 2);
        expect(pose.position.y).toBeGreaterThan(0);
        expect(pose.fov).toBeGreaterThan(10);
        expect(pose.fov).toBeLessThan(90);
      }
    }
  });

  it('서명은 소수점 흔들림을 무시해 정지 화면을 다시 그리지 않는다', () => {
    const a = { position: { x: 1, y: 2, z: 3 }, target: { x: 0, y: 0, z: 0 }, fov: 45 };
    const b = { position: { x: 1.0001, y: 2, z: 3 }, target: { x: 0, y: 0, z: 0 }, fov: 45 };
    expect(poseSignature(a)).toBe(poseSignature(b));
  });

  it('구간을 벗어난 시간도 안전하게 처리한다', () => {
    expect(() => stagePose('wave', -5, 40)).not.toThrow();
    expect(poseSignature(stagePose('wave', -5, 40))).toBe(poseSignature(stagePose('wave', 0, 40)));
    expect(poseSignature(stagePose('wave', 999, 40))).toBe(poseSignature(stagePose('wave', 40, 40)));
  });
});
```

- [ ] **Step 2: 실패 확인**

실행: `npx vitest run tests/unit/scenes/cinemaStageCamera.test.ts`
예상: FAIL — `Cannot find module '@/cinema/stage/stageCamera'`

- [ ] **Step 3: 구현**

```ts
// src/cinema/stage/stageCamera.ts
import type { FilmId } from '../filmProgram';
import { roomCenter, STAGE_DEPTH, STAGE_ROOMS, STAGE_WIDTH, type Vec3 } from './factoryLayout';

export interface StagePose { position: Vec3; target: Vec3; fov: number }

/** 카메라 연출을 받는 챕터. 나머지 챕터에서는 공장이 정지 배경으로 남는다. */
export const STAGE_CHAPTERS = ['wave', 'visor', 'visorPan'] as const;
export type StageChapter = (typeof STAGE_CHAPTERS)[number];
export function isStageChapter(id: FilmId): id is StageChapter {
  return (STAGE_CHAPTERS as readonly string[]).includes(id);
}

const vec = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
const CENTER = vec(STAGE_WIDTH / 2, 0, STAGE_DEPTH / 2);
/** 공간 챕터가 아닐 때 공장이 머무는 자리. 배경으로 조용히 깔린다. */
const RESTING: StagePose = { position: vec(-18, 44, 64), target: CENTER, fov: 42 };

const mix = (a: number, b: number, k: number) => a + (b - a) * k;
const mixVec = (a: Vec3, b: Vec3, k: number): Vec3 => vec(mix(a.x, b.x, k), mix(a.y, b.y, k), mix(a.z, b.z, k));
export function lerpPose(a: StagePose, b: StagePose, k: number): StagePose {
  return { position: mixVec(a.position, b.position, k), target: mixVec(a.target, b.target, k), fov: mix(a.fov, b.fov, k) };
}
/** 양 끝을 눌러 시작과 끝에서 부드럽게 멈춘다. */
const ease = (k: number) => k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;

const firstRoom = roomCenter(STAGE_ROOMS[0]);
const lastRoom = roomCenter(STAGE_ROOMS[STAGE_ROOMS.length - 1]);

/** 챕터마다 시작 포즈와 끝 포즈. 그 사이를 보간해 한 번의 비행으로 만든다. */
const FLIGHTS: Record<StageChapter, readonly [StagePose, StagePose]> = {
  // 온습도: 버드뷰에서 내려와 구역 열을 훑는다.
  wave: [
    { position: vec(STAGE_WIDTH / 2, 62, STAGE_DEPTH / 2 + 34), target: CENTER, fov: 40 },
    { position: vec(STAGE_WIDTH / 2, 26, STAGE_DEPTH / 2 + 14), target: vec(STAGE_WIDTH / 2, 2, STAGE_DEPTH / 2), fov: 46 },
  ],
  // SMT 3D: 첫 구역 위로 들어가 마지막 구역까지 흐름을 따라간다.
  visor: [
    { position: vec(firstRoom.x - 10, 16, firstRoom.z + 22), target: vec(firstRoom.x, 1.5, firstRoom.z), fov: 46 },
    { position: vec(lastRoom.x + 10, 16, lastRoom.z + 22), target: vec(lastRoom.x, 1.5, lastRoom.z), fov: 46 },
  ],
  // SMT 평면: 위에서 내려다보며 길이 방향으로 민다.
  visorPan: [
    { position: vec(6, 40, STAGE_DEPTH / 2), target: vec(6, 0, STAGE_DEPTH / 2), fov: 38 },
    { position: vec(STAGE_WIDTH - 6, 40, STAGE_DEPTH / 2), target: vec(STAGE_WIDTH - 6, 0, STAGE_DEPTH / 2), fov: 38 },
  ],
};

export function stagePose(chapter: FilmId, localTime: number, duration: number): StagePose {
  if (!isStageChapter(chapter)) return RESTING;
  const [from, to] = FLIGHTS[chapter];
  const span = duration > 0 ? duration : 1;
  const raw = Number.isFinite(localTime) ? localTime / span : 0;
  return lerpPose(from, to, ease(Math.min(1, Math.max(0, raw))));
}

/** 프레임 게이트 비교용. 눈에 보이지 않는 소수점 변화로 다시 그리지 않도록 자른다. */
export function poseSignature(pose: StagePose): string {
  const round = (n: number) => Math.round(n * 100) / 100;
  const { position: p, target: t } = pose;
  return `${round(p.x)},${round(p.y)},${round(p.z)}|${round(t.x)},${round(t.y)},${round(t.z)}|${round(pose.fov)}`;
}
```

- [ ] **Step 4: 통과 확인**

실행: `npx vitest run tests/unit/scenes/cinemaStageCamera.test.ts`
예상: PASS (6 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/cinema/stage/stageCamera.ts tests/unit/scenes/cinemaStageCamera.test.ts
git commit -m "feat(cinema): 챕터별 무대 카메라 연출"
```

---

### Task 4: 무대 렌더러

**파일:**
- 생성: `src/cinema/stage/factoryStage.ts`
- 생성: `src/cinema/stage/factoryModel.ts`
- 테스트: `tests/unit/scenes/cinemaFactoryStage.test.ts`

**인터페이스:**
- 사용: Task 1 의 배치 데이터, Task 3 의 `StagePose`
- 제공: `FactoryStage`, `createFactoryStage`, `buildFactoryModel`

이 단계에서는 바닥과 벽만 세운다. 설비는 Task 7 에서 채운다. 목표는 "필름 위에 3D 가 합성되는가" 하나다.

- [ ] **Step 1: 실패하는 테스트 작성**

jsdom 에는 WebGL 이 없다. 그 환경에서 무대가 조용히 꺼지는지를 테스트한다. 이게 폴백 계약이다.

```ts
// tests/unit/scenes/cinemaFactoryStage.test.ts
import { describe, expect, it } from 'vitest';
import { createFactoryStage } from '@/cinema/stage/factoryStage';

describe('무대 렌더러', () => {
  it('WebGL 을 쓸 수 없으면 null 을 돌려준다', async () => {
    const stage = await createFactoryStage();
    expect(stage).toBeNull();
  });
});
```

- [ ] **Step 2: 실패 확인**

실행: `npx vitest run tests/unit/scenes/cinemaFactoryStage.test.ts`
예상: FAIL — `Cannot find module '@/cinema/stage/factoryStage'`

- [ ] **Step 3: 구현**

```ts
// src/cinema/stage/factoryModel.ts
import type * as THREE from 'three';
import { STAGE_ROOMS, STAGE_WALLS, STAGE_WALL_THICKNESS, type WallSegment } from './factoryLayout';

export interface FactoryModel {
  root: THREE.Group;
  /** 구역 id → 바닥 메시. 히트맵이 이 메시의 색을 바꾼다. */
  floors: Map<string, THREE.Mesh>;
}

/** studio 시제품의 팔레트를 따른다: 따뜻한 도장 금속, 무광 바닥, 부드러운 주변광. */
function materials(T: typeof THREE) {
  return {
    plaster: new T.MeshStandardMaterial({ color: '#ecebe4', roughness: .86 }),
    floor: new T.MeshStandardMaterial({ color: '#a9aaa2', roughness: .65 }),
    glass: new T.MeshStandardMaterial({ color: '#213d43', roughness: .18, metalness: .5, transparent: true, opacity: .45 }),
  };
}

function addWall(T: typeof THREE, root: THREE.Group, mat: THREE.Material, glass: THREE.Material, wall: WallSegment) {
  const dx = wall.x1 - wall.x0, dz = wall.z1 - wall.z0;
  const length = Math.hypot(dx, dz);
  if (length <= 0) return;
  const ry = Math.atan2(dx, dz);
  const put = (from: number, to: number, y0: number, y1: number, material: THREE.Material) => {
    if (to - from < .02 || y1 - y0 < .02) return;
    const mid = (from + to) / 2;
    const mesh = new T.Mesh(new T.BoxGeometry(STAGE_WALL_THICKNESS, y1 - y0, to - from), material);
    mesh.position.set(wall.x0 + dx * (mid / length), (y0 + y1) / 2, wall.z0 + dz * (mid / length));
    mesh.rotation.y = ry;
    mesh.castShadow = mesh.receiveShadow = true;
    root.add(mesh);
  };
  let cursor = 0;
  for (const opening of [...wall.openings].sort((a, b) => a.at - b.at)) {
    put(cursor, opening.at, 0, wall.height, mat);
    if (opening.y0 > 0) put(opening.at, opening.at + opening.width, 0, opening.y0, mat);
    if (opening.y1 < wall.height) put(opening.at, opening.at + opening.width, opening.y1, wall.height, mat);
    if (opening.glass) put(opening.at, opening.at + opening.width, opening.y0, opening.y1, glass);
    cursor = opening.at + opening.width;
  }
  put(cursor, length, 0, wall.height, mat);
}

export function buildFactoryModel(T: typeof THREE): FactoryModel {
  const root = new T.Group();
  const mat = materials(T);
  const floors = new Map<string, THREE.Mesh>();
  for (const room of STAGE_ROOMS) {
    const mesh = new T.Mesh(
      new T.BoxGeometry(room.x1 - room.x0, .12, room.z1 - room.z0),
      mat.floor.clone());
    mesh.position.set((room.x0 + room.x1) / 2, .06, (room.z0 + room.z1) / 2);
    mesh.receiveShadow = true;
    mesh.name = room.id;
    root.add(mesh);
    floors.set(room.id, mesh);
  }
  for (const wall of STAGE_WALLS) addWall(T, root, mat.plaster, mat.glass, wall);
  return { root, floors };
}
```

```ts
// src/cinema/stage/factoryStage.ts
import type * as THREE from 'three';
import { STAGE_DEPTH, STAGE_WIDTH } from './factoryLayout';
import { buildFactoryModel } from './factoryModel';
import type { StagePose } from './stageCamera';

export interface FactoryStage {
  /** 무대를 그려 필름 캔버스의 배경으로 합성한다. */
  compose(ctx: CanvasRenderingContext2D, width: number, height: number, pose: StagePose): void;
  dispose(): void;
}

const MAX_SHADOW = 2048;

/**
 * three.js 와 WebGL 컨텍스트를 준비한다. 둘 중 하나라도 없으면 null 을 돌려주고,
 * 호출부는 합성 단계를 건너뛰어 기존 화면을 그대로 그린다.
 */
export async function createFactoryStage(): Promise<FactoryStage | null> {
  let T: typeof THREE;
  try {
    T = await import('three');
  }
  catch { return null; }

  const canvas = typeof document === 'undefined' ? null : document.createElement('canvas');
  if (!canvas) return null;
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: false });
  }
  catch { return null; }

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new T.Scene();
  scene.background = new T.Color('#17232a');
  const model = buildFactoryModel(T);
  scene.add(model.root);

  const key = new T.DirectionalLight('#fff2dc', 3.2);
  key.position.set(STAGE_WIDTH * .2, 70, STAGE_DEPTH * .8);
  key.castShadow = true;
  key.shadow.mapSize.set(MAX_SHADOW, MAX_SHADOW);
  Object.assign(key.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 220 });
  key.shadow.camera.updateProjectionMatrix();
  key.shadow.normalBias = .025;
  scene.add(key);
  scene.add(new T.HemisphereLight('#e2f0ff', '#847969', 1.2));

  const camera = new T.PerspectiveCamera(45, 1, .1, 400);
  let sized = { width: 0, height: 0 };

  return {
    compose(ctx, width, height, pose) {
      if (width <= 0 || height <= 0) return;
      if (sized.width !== width || sized.height !== height) {
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        sized = { width, height };
      }
      camera.fov = pose.fov;
      camera.position.set(pose.position.x, pose.position.y, pose.position.z);
      camera.lookAt(pose.target.x, pose.target.y, pose.target.z);
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
      ctx.drawImage(canvas, 0, 0, width, height);
    },
    dispose() {
      scene.traverse(object => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry.dispose();
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.dispose();
      });
      renderer.dispose();
    },
  };
}
```

- [ ] **Step 4: 통과 확인**

실행: `npx vitest run tests/unit/scenes/cinemaFactoryStage.test.ts && npx tsc --noEmit --incremental false`
예상: 테스트 PASS. 타입 오류 없음.

- [ ] **Step 5: 커밋**

```bash
git add src/cinema/stage/factoryStage.ts src/cinema/stage/factoryModel.ts tests/unit/scenes/cinemaFactoryStage.test.ts
git commit -m "feat(cinema): 무대 렌더러와 공장 골격"
```

---

### Task 5: 필름 루프에 합성 연결

**파일:**
- 수정: `src/cinema/useFilmPlayback.ts`

**인터페이스:**
- 사용: Task 3 의 `stagePose`, `poseSignature`, Task 4 의 `createFactoryStage`
- 제공: 없음 (내부 배선)

여기서 처음으로 화면에 3D 가 뜬다. 순수 배선이라 단위 테스트 대신 실행 화면으로 확인한다.

- [ ] **Step 1: 무대 수명 붙이기**

`useFilmPlayback.ts` 의 렌더 `useEffect` 안, `const shadowGate = createFilmShadowGate(ctx);` 다음 줄에 넣는다.

```ts
    // 무대는 비동기로 준비된다. 준비 전과 WebGL 이 없는 환경에서는 null 로 남아 합성을 건너뛴다.
    let stage: Awaited<ReturnType<typeof createFactoryStage>> = null;
    let stageDisposed = false;
    void createFactoryStage().then(ready => {
      if (stageDisposed) { ready?.dispose(); return; }
      stage = ready;
    });
```

같은 `useEffect` 의 정리 함수(`cancelAnimationFrame(frame);` 로 시작하는 블록)에 한 줄 더한다.

```ts
      stageDisposed = true; stage?.dispose(); stage = null;
```

- [ ] **Step 2: 포즈를 프레임 키에 넣기**

`const key: FilmFrameKey = {` 블록 바로 앞에 포즈를 계산한다.

```ts
      const pose = stage && !cameraView.current ? stagePose(active.chapter.id, active.localTime, active.chapter.duration) : null;
```

키의 `stagePose: null` (Task 2 에서 임시로 넣은 값)을 바꾼다.

```ts
        stagePose: pose ? poseSignature(pose) : null,
```

- [ ] **Step 3: 배경으로 합성**

`else { cameraTime = 3;` 블록에서 `drawSignalFilm` 호출 바로 앞에 넣는다.

```ts
        if (stage && pose) stage.compose(themed.ctx, node.width, node.height, pose);
```

- [ ] **Step 4: import 추가**

```ts
import { createFactoryStage } from './stage/factoryStage';
import { poseSignature, stagePose } from './stage/stageCamera';
```

- [ ] **Step 5: 화면 확인**

```bash
npx tsc --noEmit --incremental false
npm run test:unit
```

개발 서버(`http://localhost:3010/cinema`)를 열어 확인한다. `127.0.0.1` 로는 열지 않는다 — Next dev 는 `allowedDevOrigins` 에 없는 호스트의 `/_next/*` 를 차단해서 React 가 하이드레이트되지 않는다. 확인은 `aside` 로 하고 `claude-in-chrome` 은 쓰지 않는다.

이 단계에서 3D 는 아직 **눈에 보이지 않는다.** 합성 순서가 `stage.compose` → `drawSignalFilm` 이고 각 챕터 렌더러가 불투명 배경을 칠하기 때문이다. 3D 가 화면에 드러나는 것은 Task 7(2D 배경 우회)부터다. 여기서 볼 것은 필름이 평소대로 재생되는지(합성 추가가 기존 연출을 깨지 않았는지)와 콘솔에 오류가 없는지다.

- [ ] **Step 6: 커밋**

```bash
git add src/cinema/useFilmPlayback.ts
git commit -m "feat(cinema): 필름 배경에 3D 무대 합성"
```

---

## 2단계 · 공장 채우기

### Task 6: 설비 빌더

**파일:**
- 수정: `src/cinema/stage/factoryModel.ts`
- 테스트: `tests/unit/scenes/cinemaFactoryModel.test.ts`

**인터페이스:**
- 제공: `buildFactoryModel` 이 설비를 포함한 모델을 돌려준다 (시그니처 불변)

- [ ] **Step 1: 실패하는 테스트 작성**

three.js 는 순수 JS 라 jsdom 없이도 씬 그래프를 만들 수 있다. WebGL 없이 구조만 검증한다.

```ts
// tests/unit/scenes/cinemaFactoryModel.test.ts
import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { buildFactoryModel } from '@/cinema/stage/factoryModel';
import { STAGE_DEPTH, STAGE_ROOMS, STAGE_WIDTH } from '@/cinema/stage/factoryLayout';

describe('공장 모델', () => {
  const model = buildFactoryModel(T);

  it('구역마다 바닥 메시가 하나씩 있다', () => {
    expect(model.floors.size).toBe(STAGE_ROOMS.length);
    for (const room of STAGE_ROOMS) expect(model.floors.get(room.id)).toBeDefined();
  });

  it('모델이 건물 범위 안에 들어온다', () => {
    const box = new T.Box3().setFromObject(model.root);
    expect(box.min.x).toBeGreaterThanOrEqual(-1);
    expect(box.min.z).toBeGreaterThanOrEqual(-1);
    expect(box.max.x).toBeLessThanOrEqual(STAGE_WIDTH + 1);
    expect(box.max.z).toBeLessThanOrEqual(STAGE_DEPTH + 1);
  });

  it('구역마다 설비가 들어가 빈 방이 없다', () => {
    for (const room of STAGE_ROOMS) {
      const inside = model.root.children.filter(child =>
        child.position.x > room.x0 && child.position.x < room.x1
        && child.position.z > room.z0 && child.position.z < room.z1
        && child.position.y > .2);
      expect(inside.length, `${room.name} 이 비어 있다`).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: 실패 확인**

실행: `npx vitest run tests/unit/scenes/cinemaFactoryModel.test.ts`
예상: FAIL — 세 번째 테스트에서 모든 구역이 비어 있다

- [ ] **Step 3: 구현**

`factoryModel.ts` 에 빌더와 배치를 더한다. `materials` 에 색을 추가한다.

```ts
    ivory: new T.MeshStandardMaterial({ color: '#d9ddd8', roughness: .36, metalness: .22 }),
    dark: new T.MeshStandardMaterial({ color: '#263539', roughness: .42, metalness: .35 }),
    steel: new T.MeshStandardMaterial({ color: '#9aa6a9', roughness: .3, metalness: .8 }),
    bench: new T.MeshStandardMaterial({ color: '#2f7d5e', roughness: .6 }),
    rack: new T.MeshStandardMaterial({ color: '#2d5fa8', roughness: .55, metalness: .35 }),
    carton: new T.MeshStandardMaterial({ color: '#c09a68', roughness: .95 }),
```

`buildFactoryModel` 의 벽 루프 다음, `return` 앞에 설비 배치를 넣는다.

```ts
  const box = (center: Vec3, size: Vec3, material: THREE.Material) => {
    const mesh = new T.Mesh(new T.BoxGeometry(size.x, size.y, size.z), material);
    mesh.position.set(center.x, center.y + size.y / 2, center.z);
    mesh.castShadow = mesh.receiveShadow = true;
    root.add(mesh);
    return mesh;
  };
  /** 설비 한 대. 본체 위에 커버와 시그널 타워를 얹어 실루엣을 만든다. */
  const machine = (x: number, z: number) => {
    box({ x, y: .12, z }, { x: 3.4, y: 2.2, z: 2 }, mat.ivory);
    box({ x, y: 2.32, z }, { x: 2.8, y: .3, z: 1.6 }, mat.steel);
    box({ x: x + 1.3, y: .8, z: z + 1.05 }, { x: .5, y: 1.2, z: .1 }, mat.dark);
  };
  /** 작업대 한 줄. */
  const bench = (x: number, z: number, length: number) => {
    box({ x, y: .74, z }, { x: length, y: .08, z: 1 }, mat.bench);
    box({ x, y: .12, z }, { x: length - .6, y: .62, z: .1 }, mat.steel);
  };
  /** 적재 랙과 상자. */
  const rack = (x: number, z: number) => {
    box({ x, y: .12, z }, { x: 6, y: 4.2, z: 1.2 }, mat.rack);
    for (let level = 0; level < 3; level++)
      for (let bay = 0; bay < 3; bay++)
        box({ x: x - 2 + bay * 2, y: .4 + level * 1.4, z }, { x: 1.4, y: .8, z: 1 }, mat.carton);
  };

  // 구역 성격에 맞는 설비를 놓는다. 보관·입고 구역은 랙, 공정 구역은 설비, 검사·포장은 작업대.
  const fill: Record<number, (center: Vec3) => void> = {
    0: c => { rack(c.x, c.z - 3); bench(c.x, c.z + 4, 6); },
    1: c => { rack(c.x, c.z - 3); rack(c.x, c.z + 3); },
    2: c => { machine(c.x - 2, c.z); bench(c.x + 3, c.z + 4, 5); },
    3: c => { machine(c.x - 2, c.z - 3); machine(c.x - 2, c.z + 3); bench(c.x + 3, c.z, 6); },
    4: c => { machine(c.x, c.z - 2); machine(c.x, c.z + 3); },
    5: c => { bench(c.x, c.z - 3, 7); bench(c.x, c.z + 3, 7); },
    6: c => { bench(c.x, c.z - 4, 8); bench(c.x, c.z, 8); bench(c.x, c.z + 4, 8); },
    7: c => { bench(c.x, c.z, 7); rack(c.x, c.z + 5); },
    8: c => { bench(c.x, c.z - 3, 6); machine(c.x, c.z + 3); },
    9: c => { rack(c.x, c.z - 4); rack(c.x, c.z + 1); },
  };
  STAGE_ROOMS.forEach((room, index) => fill[index]?.(roomCenter(room)));
```

import 를 보강한다.

```ts
import { roomCenter, STAGE_ROOMS, STAGE_WALLS, STAGE_WALL_THICKNESS, type Vec3, type WallSegment } from './factoryLayout';
```

- [ ] **Step 4: 통과 확인**

실행: `npx vitest run tests/unit/scenes/cinemaFactoryModel.test.ts`
예상: PASS (3 tests)

- [ ] **Step 5: 화면 확인 후 커밋**

개발 서버에서 공장이 참조 배치처럼 보이는지 확인한다.

```bash
git add src/cinema/stage/factoryModel.ts tests/unit/scenes/cinemaFactoryModel.test.ts
git commit -m "feat(cinema): 무대 설비 배치"
```

---

## 3단계 · 중복 배경 제거

### Task 7: 공간 챕터의 2D 배경 우회

**파일:**
- 수정: `src/cinema/drawSignalFilm.ts`
- 수정: `src/cinema/useFilmPlayback.ts`

**인터페이스:**
- 사용: 없음
- 제공: `drawSignalFilm` 의 마지막 인자에 `stage: boolean` 추가

무대가 켜져 있으면 `wave`·`visor`·`visorPan` 이 자기 공간 묘사를 건너뛰고 HUD 만 그린다.

다행히 분리가 이미 깔끔하다. 공간을 그리는 호출은 정확히 세 군데이고 나머지는 전부 HUD 다.

| 파일 | 줄 | 호출 | 성격 |
|---|---|---|---|
| `drawWaveFilm.ts` | 42 | `drawEnvironmentHeatmap(ctx, fonts, state)` | 공간 — 건너뛴다 |
| `drawVisorTourFilm.ts` | 17 | `drawSmtFactory(ctx,fonts,state)` | 공간 — 건너뛴다 |
| `drawSmtExploreFilm.ts` | 22 | `drawSmtFactory(ctx, fonts, state)` | 공간 — 건너뛴다 |

같은 파일의 `drawEnvironmentZones`·`drawEnvironmentFocus` 는 센서 카드와 이력 차트라 HUD 이므로 그대로 둔다.
`drawEnvironmentMobile` 은 작은 화면 전용 대체 배치이므로 무대와 무관하게 유지한다.

- [ ] **Step 1: 플래그를 아래로 전달**

`drawSignalFilm.ts` 의 `Renderer` 타입 마지막에 인자를 더한다.

```ts
type Renderer = (ctx: CanvasRenderingContext2D, width: number, height: number, time: number, fonts: FilmFonts, insets: FilmViewportInsets | undefined, charts: FilmChartSettings, factory: FactoryInteraction | null, environment: ZoneEnvironmentState | null, data: FilmSceneData, machine: MachineRenderOptions, cctv: CctvFrameInput | null, stage: boolean) => void;
```

`drawSignalFilm` 의 매개변수에 `stage = false` 를 더하고 등록표 호출로 넘긴다. 공간 챕터 세 개의 렌더러만 이 값을 읽고, 나머지는 무시한다.

`drawWaveFilm`·`drawVisorFilm` 의 시그니처에도 `stage = false` 를 더하고, `drawVisorFilm` 은 받은 값을
`drawVisorTourFilm`·`drawSmtExploreFilm` 으로 넘긴다.

- [ ] **Step 2: 공간 묘사 건너뛰기**

세 군데를 조건으로 감싼다. 인자는 그대로 둔다.

```ts
// src/cinema/drawWaveFilm.ts:42
  if (!stage) drawEnvironmentHeatmap(ctx, fonts, state);
```

```ts
// src/cinema/drawVisorTourFilm.ts:17
  if (!stage) drawSmtFactory(ctx, fonts, state);
```

```ts
// src/cinema/drawSmtExploreFilm.ts:22
  if (!stage) drawSmtFactory(ctx, fonts, state);
```

- [ ] **Step 3: 호출부에서 값 넘기기**

`useFilmPlayback.ts` 의 `drawSignalFilm(...)` 호출 마지막에 더한다.

```ts
          cctvState ? { ...cctvState, live: now / 1000 } : null, !!(stage && pose));
```

- [ ] **Step 4: 확인 후 커밋**

```bash
npx tsc --noEmit --incremental false && npm run test:unit
```

개발 서버에서 공간 챕터에 공장이 한 겹만 보이는지 확인한다. 무대가 꺼진 상태(WebGL 없음)에서는
기존 2D 배경이 그대로 나와야 한다.

```bash
git add src/cinema/drawSignalFilm.ts src/cinema/drawWaveFilm.ts src/cinema/drawVisorFilm.ts \
  src/cinema/drawVisorTourFilm.ts src/cinema/drawSmtExploreFilm.ts src/cinema/useFilmPlayback.ts
git commit -m "feat(cinema): 무대가 켜지면 공간 챕터의 2D 배경을 건너뛴다"
```

---

### Task 7b: 수동 카메라 조작

**파일:**
- 수정: `src/cinema/stage/stageCamera.ts`
- 수정: `src/cinema/useFilmPlayback.ts`
- 테스트: `tests/unit/scenes/cinemaStageManual.test.ts`

**인터페이스:**
- 제공: `ManualOrbit`, `createManualOrbit`, `applyManualOrbit`

설계서 §5 의 "드래그하면 연출을 놓고 자유 카메라로, 손을 떼면 돌아온다" 를 구현한다.
기존 `SmtFactoryExplorer` 가 쓰는 수동 전환·자동 복귀 패턴을 따르되, 무대는 포즈 하나만 다루므로
궤도 각도와 거리만 저장하는 작은 상태로 충분하다.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// tests/unit/scenes/cinemaStageManual.test.ts
import { describe, expect, it } from 'vitest';
import { applyManualOrbit, createManualOrbit } from '@/cinema/stage/stageCamera';
import { stagePose } from '@/cinema/stage/stageCamera';

const base = stagePose('wave', 10, 40);

describe('수동 카메라', () => {
  it('손대지 않으면 연출 포즈를 그대로 쓴다', () => {
    const orbit = createManualOrbit();
    expect(applyManualOrbit(base, orbit)).toEqual(base);
  });

  it('좌우로 끌면 시선은 그대로 두고 카메라만 돈다', () => {
    const orbit = createManualOrbit();
    orbit.yaw = .5;
    const moved = applyManualOrbit(base, orbit);
    expect(moved.target).toEqual(base.target);
    expect(moved.position).not.toEqual(base.position);
  });

  it('확대해도 시선 아래로는 내려가지 않는다', () => {
    const orbit = createManualOrbit();
    orbit.zoom = .01;
    expect(applyManualOrbit(base, orbit).position.y).toBeGreaterThan(base.target.y);
  });

  it('위아래 회전은 바닥을 뚫지 않도록 제한된다', () => {
    const orbit = createManualOrbit();
    orbit.pitch = -10;
    expect(applyManualOrbit(base, orbit).position.y).toBeGreaterThan(base.target.y);
  });
});
```

- [ ] **Step 2: 실패 확인**

실행: `npx vitest run tests/unit/scenes/cinemaStageManual.test.ts`
예상: FAIL — `createManualOrbit` 가 없다

- [ ] **Step 3: 구현**

`stageCamera.ts` 에 더한다.

```ts
/** 연출 포즈를 기준으로 한 상대 궤도. 사용자가 손을 대는 동안만 값이 0 이 아니다. */
export interface ManualOrbit { yaw: number; pitch: number; zoom: number; active: boolean }
export function createManualOrbit(): ManualOrbit {
  return { yaw: 0, pitch: 0, zoom: 1, active: false };
}

const MIN_PITCH = -1.2, MAX_PITCH = 1.35, MIN_ZOOM = .35, MAX_ZOOM = 3;

/** 연출 포즈에 사용자의 궤도를 얹는다. 시선은 연출이 정한 곳에 그대로 둔다. */
export function applyManualOrbit(pose: StagePose, orbit: ManualOrbit): StagePose {
  if (!orbit.yaw && !orbit.pitch && orbit.zoom === 1) return pose;
  const dx = pose.position.x - pose.target.x;
  const dy = pose.position.y - pose.target.y;
  const dz = pose.position.z - pose.target.z;
  const radius = Math.hypot(dx, dy, dz) * Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, orbit.zoom));
  const yaw = Math.atan2(dx, dz) + orbit.yaw;
  // 바닥을 뚫거나 천장을 넘지 않도록 올려다보는 각을 가둔다.
  const pitch = Math.min(MAX_PITCH, Math.max(MIN_PITCH, Math.asin(dy / (Math.hypot(dx, dy, dz) || 1)) + orbit.pitch));
  const flat = Math.cos(pitch) * radius;
  return {
    ...pose,
    position: {
      x: pose.target.x + Math.sin(yaw) * flat,
      y: pose.target.y + Math.max(.8, Math.sin(pitch) * radius),
      z: pose.target.z + Math.cos(yaw) * flat,
    },
  };
}
```

- [ ] **Step 4: 통과 확인**

실행: `npx vitest run tests/unit/scenes/cinemaStageManual.test.ts`
예상: PASS (4 tests)

- [ ] **Step 5: 필름 캔버스에 연결**

`useFilmPlayback.ts` 의 렌더 `useEffect` 안에 궤도 상태와 포인터 처리를 더한다.
기존 `noteInput` 이 이미 `pointerdown` 을 잡고 있으므로 그 옆에 나란히 둔다.

```ts
    const orbit = createManualOrbit();
    let orbitAt = 0, dragging: { x: number; y: number } | null = null;
    const RETURN_MS = 4000;
    const onDown = (event: PointerEvent) => { dragging = { x: event.clientX, y: event.clientY }; orbit.active = true; };
    const onMove = (event: PointerEvent) => {
      if (!dragging) return;
      orbit.yaw -= (event.clientX - dragging.x) * .005;
      orbit.pitch += (event.clientY - dragging.y) * .004;
      dragging = { x: event.clientX, y: event.clientY };
      orbitAt = performance.now();
    };
    const onUp = () => { dragging = null; orbitAt = performance.now(); };
    const onWheel = (event: WheelEvent) => { orbit.zoom *= event.deltaY > 0 ? 1.08 : .92; orbitAt = performance.now(); };
    node.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    node.addEventListener('wheel', onWheel, { passive: true });
```

정리 함수에서 모두 떼어낸다.

```ts
      node.removeEventListener('pointerdown', onDown); window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp); node.removeEventListener('wheel', onWheel);
```

포즈 계산을 수동 궤도까지 반영하도록 바꾼다. 손을 뗀 뒤 4초가 지나면 궤도를 서서히 0 으로 되돌려
연출로 복귀한다.

```ts
      let pose = stage && !cameraView.current ? stagePose(active.chapter.id, active.localTime, active.chapter.duration) : null;
      if (pose) {
        if (!dragging && orbitAt && now - orbitAt > RETURN_MS) {
          orbit.yaw *= .94; orbit.pitch *= .94; orbit.zoom += (1 - orbit.zoom) * .06;
          if (Math.abs(orbit.yaw) < .002 && Math.abs(orbit.pitch) < .002 && Math.abs(orbit.zoom - 1) < .002) {
            orbit.yaw = orbit.pitch = 0; orbit.zoom = 1; orbit.active = false; orbitAt = 0;
          }
        }
        pose = applyManualOrbit(pose, orbit);
      }
```

import 를 보강한다.

```ts
import { applyManualOrbit, createManualOrbit, poseSignature, stagePose } from './stage/stageCamera';
```

- [ ] **Step 6: 화면 확인 후 커밋**

드래그로 카메라가 돌고, 휠로 확대·축소되며, 손을 떼고 4초 뒤 연출로 돌아오는지 확인한다.

```bash
git add src/cinema/stage/stageCamera.ts src/cinema/useFilmPlayback.ts tests/unit/scenes/cinemaStageManual.test.ts
git commit -m "feat(cinema): 무대 수동 카메라 조작과 자동 복귀"
```

---

## 4단계 · 히트맵과 센서

### Task 8: 월드 → 화면 투영

**파일:**
- 생성: `src/cinema/stage/stageProjection.ts`
- 테스트: `tests/unit/scenes/cinemaStageProjection.test.ts`

**인터페이스:**
- 사용: Task 1 의 `Vec3`, Task 3 의 `StagePose`
- 제공: `ScreenPoint`, `projectToScreen`

three.js 의 카메라 행렬과 같은 식을 쓰되 three.js 를 불러오지 않는다. 센서 카드는 React 쪽에서 계산하므로 순수 함수여야 한다.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// tests/unit/scenes/cinemaStageProjection.test.ts
import { describe, expect, it } from 'vitest';
import { projectToScreen } from '@/cinema/stage/stageProjection';
import type { StagePose } from '@/cinema/stage/stageCamera';

const pose: StagePose = { position: { x: 0, y: 0, z: 10 }, target: { x: 0, y: 0, z: 0 }, fov: 45 };

describe('무대 투영', () => {
  it('시선이 향한 점은 화면 중앙에 온다', () => {
    const point = projectToScreen(pose, { x: 0, y: 0, z: 0 }, 16 / 9);
    expect(point.visible).toBe(true);
    expect(point.x).toBeCloseTo(.5, 5);
    expect(point.y).toBeCloseTo(.5, 5);
  });

  it('오른쪽 점은 화면 오른쪽에, 위쪽 점은 화면 위쪽에 온다', () => {
    expect(projectToScreen(pose, { x: 2, y: 0, z: 0 }, 16 / 9).x).toBeGreaterThan(.5);
    expect(projectToScreen(pose, { x: 0, y: 2, z: 0 }, 16 / 9).y).toBeLessThan(.5);
  });

  it('카메라 뒤의 점은 보이지 않는다', () => {
    expect(projectToScreen(pose, { x: 0, y: 0, z: 30 }, 16 / 9).visible).toBe(false);
  });

  it('화면 밖으로 나간 점도 보이지 않는다고 표시한다', () => {
    expect(projectToScreen(pose, { x: 400, y: 0, z: 0 }, 16 / 9).visible).toBe(false);
  });

  it('가로가 넓어지면 같은 점이 중앙 쪽으로 모인다', () => {
    const wide = projectToScreen(pose, { x: 2, y: 0, z: 0 }, 32 / 9);
    const narrow = projectToScreen(pose, { x: 2, y: 0, z: 0 }, 16 / 9);
    expect(wide.x - .5).toBeLessThan(narrow.x - .5);
  });
});
```

- [ ] **Step 2: 실패 확인**

실행: `npx vitest run tests/unit/scenes/cinemaStageProjection.test.ts`
예상: FAIL — `Cannot find module '@/cinema/stage/stageProjection'`

- [ ] **Step 3: 구현**

```ts
// src/cinema/stage/stageProjection.ts
import type { Vec3 } from './factoryLayout';
import type { StagePose } from './stageCamera';

/** 화면 비율 좌표. x·y 는 0~1 이고 좌상단이 원점이다. CSS 변수에 그대로 퍼센트로 쓴다. */
export interface ScreenPoint { x: number; y: number; visible: boolean }

const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x,
});
function unit(v: Vec3): Vec3 {
  const length = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / length, y: v.y / length, z: v.z / length };
}

const UP: Vec3 = { x: 0, y: 1, z: 0 };

/**
 * three.js 의 `PerspectiveCamera` 와 같은 규약으로 월드 좌표를 화면 비율로 바꾼다.
 * 무대 렌더러가 카메라를 어떻게 세우는지와 어긋나면 센서 카드가 엉뚱한 곳에 붙으므로,
 * 시선 기준 벡터를 같은 방식(lookAt, up = +Y)으로 만든다.
 */
export function projectToScreen(pose: StagePose, point: Vec3, aspect: number): ScreenPoint {
  const forward = unit(sub(pose.target, pose.position));
  // 카메라가 수직으로 내려다보면 up 과 forward 가 평행해져 오른쪽 축을 만들 수 없다. 그때는 +Z 를 위로 삼는다.
  const reference = Math.abs(dot(forward, UP)) > .999 ? { x: 0, y: 0, z: 1 } : UP;
  const right = unit(cross(forward, reference));
  const up = cross(right, forward);

  const relative = sub(point, pose.position);
  const depth = dot(relative, forward);
  if (depth <= .01) return { x: .5, y: .5, visible: false };

  const half = Math.tan((pose.fov * Math.PI / 180) / 2);
  const ndcX = dot(relative, right) / (depth * half * aspect);
  const ndcY = dot(relative, up) / (depth * half);
  const x = ndcX * .5 + .5;
  const y = .5 - ndcY * .5;
  return { x, y, visible: x >= 0 && x <= 1 && y >= 0 && y <= 1 };
}
```

- [ ] **Step 4: 통과 확인**

실행: `npx vitest run tests/unit/scenes/cinemaStageProjection.test.ts`
예상: PASS (5 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/cinema/stage/stageProjection.ts tests/unit/scenes/cinemaStageProjection.test.ts
git commit -m "feat(cinema): 무대 월드 좌표 화면 투영"
```

---

### Task 9: 구역 히트맵

**파일:**
- 수정: `src/cinema/stage/factoryStage.ts`
- 수정: `src/cinema/useFilmPlayback.ts`
- 테스트: `tests/unit/scenes/cinemaStageHeatmap.test.ts`

**인터페이스:**
- 제공: `FactoryStage.setZoneStatus(statuses: ReadonlyMap<string, ReadingStatus>): void`, `zoneStatusColor(status: ReadingStatus): string`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// tests/unit/scenes/cinemaStageHeatmap.test.ts
import { describe, expect, it } from 'vitest';
import { zoneStatusColor } from '@/cinema/stage/factoryStage';

describe('구역 상태 색', () => {
  it('세 상태가 서로 다른 색을 쓴다', () => {
    const colors = ['normal', 'outside', 'missing'].map(status => zoneStatusColor(status as never));
    expect(new Set(colors).size).toBe(3);
  });
  it('이탈은 센서 카드와 같은 앰버 계열이다', () => {
    expect(zoneStatusColor('outside')).toBe('#edac63');
  });
});
```

- [ ] **Step 2: 실패 확인**

실행: `npx vitest run tests/unit/scenes/cinemaStageHeatmap.test.ts`
예상: FAIL — `zoneStatusColor` 가 없다

- [ ] **Step 3: 구현**

`factoryStage.ts` 에 색 규칙과 적용 함수를 더한다. 색은 기존 센서 카드 테두리 체계를 따른다.

```ts
import type { ReadingStatus } from '../zoneEnvironment';

/** 센서 카드의 테두리 색 체계를 바닥에 그대로 옮긴다. 새 색을 만들지 않는다. */
export function zoneStatusColor(status: ReadingStatus): string {
  if (status === 'outside') return '#edac63';
  if (status === 'missing') return '#6b7478';
  return '#7fb8a6';
}
```

`createFactoryStage` 의 반환 객체에 메서드를 더한다. 기본 바닥색을 기억해 두고 값이 없는 구역은 되돌린다.

```ts
  const baseFloor = new Map<string, THREE.Color>();
  for (const [id, mesh] of model.floors) {
    baseFloor.set(id, (mesh.material as THREE.MeshStandardMaterial).color.clone());
  }
```

```ts
    setZoneStatus(statuses) {
      for (const [id, mesh] of model.floors) {
        const material = mesh.material as THREE.MeshStandardMaterial;
        const status = statuses.get(id);
        // 값이 없는 구역은 칠하지 않는다. 시연 데이터와 실데이터 구분 표시는 기존 규칙을 따른다.
        if (!status) { material.color.copy(baseFloor.get(id)!); continue; }
        material.color.set(zoneStatusColor(status));
      }
    },
```

인터페이스에도 더한다.

```ts
export interface FactoryStage {
  compose(ctx: CanvasRenderingContext2D, width: number, height: number, pose: StagePose): void;
  setZoneStatus(statuses: ReadonlyMap<string, ReadingStatus>): void;
  dispose(): void;
}
```

`useFilmPlayback.ts` 에서 온습도 챕터일 때만 상태를 넘긴다. `pose` 계산 다음에 둔다.

```ts
      if (stage && pose && active.chapter.id === 'wave') {
        const statuses = new Map(data.environment.zones.map(zone => [zone.id, environmentZoneStatus(zone)] as const));
        stage.setZoneStatus(statuses);
      }
```

`environmentZoneStatus` 를 import 한다.

- [ ] **Step 4: 통과 확인**

실행: `npx vitest run tests/unit/scenes/cinemaStageHeatmap.test.ts && npx tsc --noEmit --incremental false`
예상: PASS

- [ ] **Step 5: 화면 확인 후 커밋**

온습도 챕터에서 이탈 구역(기본 데이터의 `검사 공정` 29.4도, `검사 대기` 습도 64%)이 앰버로 물드는지 본다.

```bash
git add src/cinema/stage/factoryStage.ts src/cinema/useFilmPlayback.ts tests/unit/scenes/cinemaStageHeatmap.test.ts
git commit -m "feat(cinema): 구역 상태 히트맵"
```

---

### Task 10: 센서 카드를 3D 위치에 붙이기

**파일:**
- 수정: `src/cinema/useFilmPlayback.ts`
- 수정: `src/cinema/SignalFilm.tsx`
- 수정: `src/cinema/EnvironmentFloorMonitor.tsx`
- 수정: `src/cinema/environmentFloorMonitor.module.css`

**인터페이스:**
- 사용: Task 8 의 `projectToScreen`, Task 1 의 `sensorAnchor`
- 제공: `useFilmPlayback` 반환값에 `stagePoseRef: RefObject<StagePose | null>`

포즈는 매 프레임 바뀐다. React 상태로 올리면 렌더가 폭주하므로 ref 로 전달하고, 카드는 자기 rAF 없이 기존 필름 루프가 도는 동안 CSS 변수만 갱신한다.

**먼저 알아야 할 것:** `.monitor` 는 `position:absolute; inset:0; z-index:3; background:#081723` 로
필름 캔버스를 통째로 덮는 불투명 판이다. 이대로면 뒤의 3D 무대가 전혀 보이지 않는다.
무대가 켜진 동안에는 배경과 `<img>` 를 걷어내 캔버스가 비치게 해야 한다.

- [ ] **Step 1: 포즈를 ref 로 노출**

`useFilmPlayback.ts` 의 훅 본문 위쪽(다른 ref 선언 옆)에 더한다.

```ts
  const stagePoseRef = useRef<StagePose | null>(null);
```

렌더 함수에서 포즈를 계산한 직후에 채운다.

```ts
      stagePoseRef.current = pose;
```

반환 객체에 더한다.

```ts
    stagePoseRef,
```

- [ ] **Step 2: SignalFilm 에서 전달**

```tsx
          && <EnvironmentFloorMonitor data={player.sceneData.environment} feedStatus={player.feedStatus} stagePose={player.stagePoseRef} />}
```

- [ ] **Step 3: 카드 위치를 투영으로 갱신**

`EnvironmentFloorMonitor.tsx` 상단에 import 를 더한다.

```tsx
import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { sensorAnchor } from './stage/factoryLayout';
import { projectToScreen } from './stage/stageProjection';
import type { StagePose } from './stage/stageCamera';
```

prop 과 효과를 더한다. 기존 `positions` 배열은 무대가 없을 때의 대체값으로 남긴다.

```tsx
export function EnvironmentFloorMonitor({ data, feedStatus, stagePose }: {
  data: ZoneEnvironmentData; feedStatus?: FeedPollSummary | null;
  stagePose?: RefObject<StagePose | null>;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [onStage, setOnStage] = useState(false);
  useEffect(() => {
    if (!stagePose) return;
    let frame = 0;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const pose = stagePose.current;
      const node = mapRef.current;
      // 무대가 꺼져 있으면(WebGL 없음) 기존 고정 배치로 되돌아간다.
      setOnStage(previous => previous === !!pose ? previous : !!pose);
      if (!pose || !node) return;
      const { width, height } = node.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;
      const aspect = width / height;
      for (const [index, button] of [...node.querySelectorAll<HTMLElement>('[data-sensor]')].entries()) {
        const anchor = sensorAnchor(index);
        const point = anchor && projectToScreen(pose, anchor, aspect);
        if (!point || !point.visible) { button.hidden = true; continue; }
        button.hidden = false;
        button.style.setProperty('--x', `${point.x * 100}%`);
        button.style.setProperty('--y', `${point.y * 100}%`);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [stagePose]);
```

`<section className={styles.monitor}>` 에 `data-stage={onStage || undefined}` 를 달고,
`<div className={styles.map}>` 에 `ref={mapRef}` 를 단다. 센서 버튼 두 곳(미연결 슬롯과 정상 슬롯)에
`data-sensor` 속성을 더한다.

- [ ] **Step 3b: 무대가 켜지면 배경을 비운다**

`environmentFloorMonitor.module.css` 끝에 더한다. 무대가 꺼져 있으면 아무것도 바뀌지 않는다.

```css
.monitor[data-stage]{background:transparent}
.monitor[data-stage] .map img{display:none}
```

- [ ] **Step 4: 확인**

```bash
npx tsc --noEmit --incremental false && npm run test:unit && npm run build
```

개발 서버에서 카메라가 움직일 때 센서 카드가 구역을 따라다니는지, 화면 밖 센서가 숨는지 확인한다.

- [ ] **Step 5: 커밋**

```bash
git add src/cinema/useFilmPlayback.ts src/cinema/SignalFilm.tsx \
  src/cinema/EnvironmentFloorMonitor.tsx src/cinema/environmentFloorMonitor.module.css
git commit -m "feat(cinema): 센서 카드를 무대 좌표에 붙인다"
```

---

### Task 11: DESIGN.md 갱신

**파일:**
- 수정: `DESIGN.md`

- [ ] **Step 1: 렌더러 규정 교체**

"렌더러는 세 층이며 WebGL/Three.js는 쓰지 않는다" 항목을 네 층 구조로 고친다. WebGL 층이 공간 배경을 맡고, 기존 세 층이 그 위에 얹히며, 엔진 도입 조건(자유 카메라·조명·재질)이 충족되어 2026-09-21 에 도입했다고 적는다.

- [ ] **Step 2: 온습도 장면 규정 교체**

"마지막 공간은 정적 이미지이며 WebGL을 실행하지 않는다" 를 무대 기반으로 고친다. 센서 카드는 DOM 으로 남고 위치만 무대 좌표 투영으로 갱신하며, 값의 출처와 10개 규칙은 그대로라고 명시한다.

- [ ] **Step 3: 영향 경로 추가**

`useFilmPlayback → stage/factoryStage → stage/factoryModel / stage/stageCamera / stage/stageProjection; SignalFilm → EnvironmentFloorMonitor` 를 적고, 검증 테스트 이름(`cinemaStageLayout`, `cinemaStageCamera`, `cinemaStageProjection`, `cinemaFactoryModel`, `cinemaStageHeatmap`, `cinemaStageFrameGate`)을 남긴다.

- [ ] **Step 4: 커밋**

```bash
git add DESIGN.md
git commit -m "docs(cinema): 3D 무대 도입에 맞춰 렌더러 규정 갱신"
```

---

## 남은 판단

5단계(기존 Canvas 2D 공간 장면 제거 여부)는 이 계획의 범위 밖이다. Task 7 에서 우회만 해 두었으므로,
3D 가 안정된 뒤 별도로 판단한다. 그때까지 두 경로가 공존하며 WebGL 이 없는 환경의 폴백으로도 쓰인다.
