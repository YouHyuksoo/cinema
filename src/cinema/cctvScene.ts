import { createHoloProjection, type HoloPoint } from './holoSpace';
import { smooth } from './filmDrawing';
import { clamp } from './filmMath';

/** CCTV surveillance: nine synthetic camera feeds on a concave wall around the viewer, browsed by turning. */
export const CCTV_FILM_SECONDS = 56;
export const CCTV_INTRO_SECONDS = 2.6;
/** Nine patrol slots of 4.2s, then the wall folds flat into the console's 3×3 multi-view and holds there until the fade. */
export const CCTV_PATROL_SECONDS = 37.8;
export const CCTV_MORPH_SECONDS = 1.4;
export const CCTV_OUTRO_SECONDS = 1.6;
export const CCTV_PATROL_END = CCTV_INTRO_SECONDS + CCTV_PATROL_SECONDS;
export const CCTV_WALL_START = CCTV_PATROL_END + CCTV_MORPH_SECONDS;

export type CctvKind = 'gate' | 'parking' | 'crossroad' | 'facade' | 'skyline' | 'yard' | 'walkway' | 'lobby' | 'perimeter';
export interface CctvCamera { id: string; code: string; zone: string; kind: CctvKind; note: string }

export const CCTV_CAMERAS: readonly CctvCamera[] = [
  { id: 'CAM 01', code: 'GATE-01', zone: '정문 게이트', kind: 'gate', note: '차단기 · 차량 진입 대기' },
  { id: 'CAM 02', code: 'PARK-01', zone: '주차장', kind: 'parking', note: '2열 주차 · 순환 차량 1' },
  { id: 'CAM 03', code: 'XRD-01', zone: '정문 사거리', kind: 'crossroad', note: '신호 주기 14초 · 횡단 보행' },
  { id: 'CAM 04', code: 'BLDG-A', zone: '사무동 외벽', kind: 'facade', note: '정면 출입구 · 보행자 2' },
  { id: 'CAM 05', code: 'ROOF-01', zone: '옥상 스카이라인', kind: 'skyline', note: '야간 · 항공 장애등 점멸' },
  { id: 'CAM 06', code: 'YARD-01', zone: '물류 야드', kind: 'yard', note: '컨테이너 적치 · 트럭 진행' },
  { id: 'CAM 07', code: 'WALK-01', zone: '보행로', kind: 'walkway', note: '가로수길 · 보행자 3' },
  { id: 'CAM 08', code: 'LOBBY-01', zone: '로비 입구', kind: 'lobby', note: '회전문 · 출입 감지' },
  { id: 'CAM 09', code: 'FENCE-09', zone: '외곽 담장', kind: 'perimeter', note: 'IR 야간 · 순찰등 스윕' },
];
export const CCTV_CAMERA_COUNT = CCTV_CAMERAS.length;

/** Wall geometry: a cylinder of radius WALL_RADIUS whose axis passes behind the camera (eye at z = -EYE). */
export const CCTV_PANEL_STEP = 14 * Math.PI / 180;
export const CCTV_WALL_RADIUS = 1400;
export const CCTV_WALL_CENTER_Z = -1150;
export const CCTV_PANEL_WIDTH = 330;
export const CCTV_PANEL_HEIGHT = 186;
/** How far a focused panel comes toward the viewer along the wall normal. */
export const CCTV_FOCUS_PULL = 300;
/** A camera counts as fully centred within this angle of the heading; focus fades out by CCTV_FOCUS_FADE (under half a step). */
export const CCTV_FOCUS_ANGLE = 2.5 * Math.PI / 180;
export const CCTV_FOCUS_FADE = 6.5 * Math.PI / 180;
export const CCTV_HALF_VISIBLE = 80 * Math.PI / 180;

export const cctvCameraAngle = (index: number) => (index - (CCTV_CAMERA_COUNT - 1) / 2) * CCTV_PANEL_STEP;

/** Manual browsing: the wall heading and an explicitly selected camera; feeds keep running on `live`. */
export interface CctvInteraction { turn: number; selected: number | null }
export interface CctvFrameInput extends CctvInteraction { live: number }

export interface CctvTour { turn: number; focus: number; camera: number; intro: number; outro: number; /** 0 on the concave wall, 1 once every feed sits in the console grid. */ wall: number }

const wrap = (angle: number) => ((angle + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
const ease = (t: number) => { const x = clamp(t, 0, 1); return x * x * (3 - 2 * x); };

/**
 * Automatic patrol: sweep in from the left, then visit every camera in order. Each slot travels to the
 * camera, approaches it (focus grows), holds for reading and retreats before the next travel, so the
 * depth motion is visible on the same seekable scene clock.
 */
export function cctvTourAt(time: number): CctvTour {
  const t = clamp(time, 0, CCTV_FILM_SECONDS);
  const intro = smooth(0, CCTV_INTRO_SECONDS, t);
  const outro = 1 - smooth(CCTV_FILM_SECONDS - CCTV_OUTRO_SECONDS, CCTV_FILM_SECONDS, t);
  const slot = CCTV_PATROL_SECONDS / CCTV_CAMERA_COUNT;
  if (t < CCTV_INTRO_SECONDS) {
    const from = cctvCameraAngle(0) - 70 * Math.PI / 180;
    return { turn: from + (cctvCameraAngle(0) - from) * ease(t / CCTV_INTRO_SECONDS), focus: 0, camera: 0, intro, outro, wall: 0 };
  }
  if (t >= CCTV_PATROL_END) {
    // Fold: the heading swings back to the middle camera while every panel flies into its grid cell.
    const wall = ease((t - CCTV_PATROL_END) / CCTV_MORPH_SECONDS);
    const last = cctvCameraAngle(CCTV_CAMERA_COUNT - 1), middle = cctvCameraAngle((CCTV_CAMERA_COUNT - 1) / 2);
    return { turn: last + (middle - last) * wall, focus: 0, camera: CCTV_CAMERA_COUNT - 1, intro, outro, wall };
  }
  const local = t - CCTV_INTRO_SECONDS;
  const camera = Math.min(CCTV_CAMERA_COUNT - 1, Math.floor(local / slot));
  const phase = local - camera * slot;
  const travel = camera === 0 ? 0 : ease(phase / (slot * .28));
  const turn = cctvCameraAngle(Math.max(0, camera - 1)) + (cctvCameraAngle(camera) - cctvCameraAngle(Math.max(0, camera - 1))) * travel;
  const focus = smooth(slot * .3, slot * .52, phase) * (1 - smooth(slot * .84, slot, phase));
  return { turn, focus, camera, intro, outro, wall: 0 };
}

/** The camera nearest the heading and how strongly it is centred (0 beyond CCTV_FOCUS_FADE). */
export function cctvCentred(turn: number) {
  let best = 0, distance = Infinity;
  for (let index = 0; index < CCTV_CAMERA_COUNT; index++) {
    const d = Math.abs(wrap(cctvCameraAngle(index) - turn));
    if (d < distance) { distance = d; best = index; }
  }
  return { camera: best, amount: 1 - smooth(CCTV_FOCUS_ANGLE, CCTV_FOCUS_FADE, distance) };
}

export interface CctvPanelPose {
  index: number; corners: { x: number; y: number }[]; center: { x: number; y: number }; scale: number;
  depth: number; angle: number; focus: number; visible: boolean;
}

export const cctvProjection = (width = 1280, height = 720) =>
  createHoloProjection({ x: width / 2, y: height * .47, yaw: 0, pitch: .04, distance: 900 });

function panelWorld(index: number, turn: number, focus: number): { center: HoloPoint; right: HoloPoint; up: HoloPoint; angle: number } {
  const angle = wrap(cctvCameraAngle(index) - turn);
  const sin = Math.sin(angle), cos = Math.cos(angle);
  const radius = CCTV_WALL_RADIUS - CCTV_FOCUS_PULL * focus;
  return { angle, center: { x: radius * sin, y: 0, z: CCTV_WALL_CENTER_Z + radius * cos },
    right: { x: cos, y: 0, z: -sin }, up: { x: 0, y: 1, z: 0 } };
}

/** Screen quads of every panel for the given heading; `focusOf` gives each camera's pull toward the viewer. */
export function cctvPanelPoses(turn: number, focusOf: (index: number) => number, width = 1280, height = 720): CctvPanelPose[] {
  const project = cctvProjection(width, height);
  return CCTV_CAMERAS.map((_, index) => {
    const focus = clamp(focusOf(index), 0, 1);
    const { center, right, up, angle } = panelWorld(index, turn, focus);
    const w = CCTV_PANEL_WIDTH / 2 * (1 + focus * .12), h = CCTV_PANEL_HEIGHT / 2 * (1 + focus * .12);
    const corner = (sx: number, sy: number) => project({
      x: center.x + right.x * w * sx + up.x * h * sy, y: center.y + right.y * w * sx + up.y * h * sy, z: center.z + right.z * w * sx + up.z * h * sy });
    const corners = [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)].map(p => ({ x: p.x, y: p.y }));
    const projected = project(center);
    const visible = Math.abs(angle) < CCTV_HALF_VISIBLE && projected.depth > -820;
    return { index, corners, center: { x: projected.x, y: projected.y }, scale: projected.scale, depth: projected.depth, angle, focus, visible };
  });
}

/** Console layout for the final multi-view (logical 1280×720): sidebar, 3×3 grid, bottom timeline. */
export const CCTV_CONSOLE = { top: { y: 62, height: 38 }, side: { x: 72, y: 108, width: 208, height: 490 }, grid: { x: 296, y: 108, width: 912, height: 490, gap: 14, columns: 3, rows: 3 }, bottom: { y: 612, height: 36 } } as const;

/** Screen corners of camera `index`'s cell in the console grid, keeping the panel aspect and centring the block. */
export function cctvGridCorners(index: number) {
  const g = CCTV_CONSOLE.grid;
  const cellH = (g.height - g.gap * (g.rows - 1)) / g.rows;
  const cellW = cellH * CCTV_PANEL_WIDTH / CCTV_PANEL_HEIGHT;
  const blockW = cellW * g.columns + g.gap * (g.columns - 1);
  const x0 = g.x + (g.width - blockW) / 2, y0 = g.y;
  const i = clamp(Math.round(Number.isFinite(index) ? index : 0), 0, CCTV_CAMERA_COUNT - 1);
  const c = i % g.columns, r = Math.floor(i / g.columns);
  const x = x0 + c * (cellW + g.gap), y = y0 + r * (cellH + g.gap);
  return [{ x, y }, { x: x + cellW, y }, { x: x + cellW, y: y + cellH }, { x, y: y + cellH }];
}

/** Points along the wall's top or bottom rail, for the curved guide lines behind the panels. */
export function cctvRail(_turn: number, y: number, width = 1280, height = 720, steps = 40) {
  const project = cctvProjection(width, height);
  const points: { x: number; y: number; depth: number }[] = [];
  const from = -CCTV_HALF_VISIBLE, to = CCTV_HALF_VISIBLE;
  for (let i = 0; i <= steps; i++) {
    const angle = from + (to - from) * i / steps; // the rail is fixed to the room; only the panels ride the heading
    const p = project({ x: CCTV_WALL_RADIUS * Math.sin(angle), y, z: CCTV_WALL_CENTER_Z + CCTV_WALL_RADIUS * Math.cos(angle) });
    points.push({ x: p.x, y: p.y, depth: p.depth });
  }
  return points;
}

function inQuad(point: { x: number; y: number }, quad: { x: number; y: number }[]) {
  let inside = false;
  for (let i = 0, j = quad.length - 1; i < quad.length; j = i++) {
    const a = quad[i], b = quad[j];
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** The camera under a screen point (nearest panel wins where quads overlap), or null. */
export function cctvPick(point: { x: number; y: number }, turn: number, focusOf: (index: number) => number, width = 1280, height = 720) {
  const hits = cctvPanelPoses(turn, focusOf, width, height).filter(pose => pose.visible && inQuad(point, pose.corners));
  if (!hits.length) return null;
  return hits.sort((a, b) => b.depth - a.depth)[0].index;
}

/** Taking manual control keeps the heading the patrol currently shows, so nothing jumps. */
export function createCctvInteraction(time: number): CctvInteraction {
  return { turn: cctvTourAt(time).turn, selected: null };
}
export function turnCctv(state: CctvInteraction, dx: number): CctvInteraction {
  const delta = Number.isFinite(dx) ? clamp(dx, -4000, 4000) * .0028 : 0;
  const limit = cctvCameraAngle(CCTV_CAMERA_COUNT - 1) + CCTV_PANEL_STEP * .6;
  return { turn: clamp(state.turn - delta, -limit, limit), selected: null };
}
/** Release: settle on the nearest camera so the browsed feed is always centred. */
export function settleCctv(state: CctvInteraction): CctvInteraction {
  const { camera } = cctvCentred(state.turn);
  return { turn: cctvCameraAngle(camera), selected: state.selected ?? camera };
}
export function selectCctv(state: CctvInteraction, index: number): CctvInteraction {
  const camera = clamp(Math.round(Number.isFinite(index) ? index : 0), 0, CCTV_CAMERA_COUNT - 1);
  return { turn: cctvCameraAngle(camera), selected: camera };
}
export function stepCctv(state: CctvInteraction, direction: 1 | -1): CctvInteraction {
  return selectCctv(state, cctvCentred(state.turn).camera + direction);
}

/** Recording clock shown on every feed: a fixed demo start plus scene time. */
export function cctvTimestamp(seconds: number) {
  const base = Date.UTC(2026, 8, 10, 10, 42, 0);
  const at = new Date(base + Math.max(0, seconds) * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${at.getUTCFullYear()}-${pad(at.getUTCMonth() + 1)}-${pad(at.getUTCDate())} ${pad(at.getUTCHours())}:${pad(at.getUTCMinutes())}:${pad(at.getUTCSeconds())}`;
}
