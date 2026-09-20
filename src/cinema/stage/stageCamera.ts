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
  // SMT 3D: 건물 밖 서쪽에서 남쪽으로 당겨보는 U자 흐름 따라가기.
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
