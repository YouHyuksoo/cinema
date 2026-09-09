export type Point = { x: number; y: number };
export type Viewport = { width: number; height: number };
export type CubeMomentum = { center: Point; velocity: Point };
export type CubeAxis = 'front' | 'back' | 'right' | 'left' | 'top' | 'bottom';

export const CUBE_EDGE_PADDING = 16;
export const CUBE_FLOAT_AMPLITUDE = 4;
export const CUBE_CAPTION_CLEARANCE = 28;
export const CUBE_CAPTION_MAX_WIDTH = 180;
export const CUBE_DRAG_THRESHOLD = 7;

export const CUBE_STICKERS_PER_FACE = 9;
export const CUBE_CENTER_STICKER = 4;
export const CUBE_TWIST_DELAY_MS = 1000;
export const CUBE_MOVE_MS = 320;
export const CUBE_SCRAMBLE_MOVES = 8;

export const CUBE_FACES = [
  { id: 'admin', axis: 'front' as const, label: '관리', sticker: '#c41e3a' },
  { id: 'ai', axis: 'right' as const, label: 'AI', sticker: '#0051ba' },
  { id: 'voice', axis: 'left' as const, label: '음성', sticker: '#009e60' },
  { id: 'feeds', axis: 'back' as const, label: '피드', sticker: '#ff6a00' },
  { id: 'display', axis: 'top' as const, label: '화면', sticker: '#f3f3f3' },
  { id: 'system', axis: 'bottom' as const, label: '설정', sticker: '#ffd500' },
] as const;

function finiteSize(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function cubeSize(viewportWidth: number, viewportHeight: number) {
  const width = finiteSize(viewportWidth), height = finiteSize(viewportHeight);
  // Scale with the viewport (9% of its width, 11.5% of its height) between 48px and 86px; the upper
  // bound is 80% of the original desktop cube so it stays a secondary control beside the globe.
  const preferred = Math.round(Math.max(48, Math.min(86, width * .09, height * .115)));
  const horizontalFit = width - CUBE_EDGE_PADDING * 2;
  const verticalFit = height - CUBE_EDGE_PADDING * 2 - CUBE_FLOAT_AMPLITUDE * 2 - CUBE_CAPTION_CLEARANCE;
  return Math.max(0, Math.min(preferred, horizontalFit, verticalFit));
}

export function clampCubeCenter(center: Point, viewport: Viewport, size: number): Point {
  const width = finiteSize(viewport.width), height = finiteSize(viewport.height);
  const radius = finiteSize(size) / 2;
  const captionRadius = Math.min(CUBE_CAPTION_MAX_WIDTH / 2,
    Math.max(0, width - CUBE_EDGE_PADDING * 2) / 2);
  const horizontalRadius = Math.max(radius, captionRadius);
  const minX = horizontalRadius + CUBE_EDGE_PADDING;
  const maxX = Math.max(minX, width - horizontalRadius - CUBE_EDGE_PADDING);
  const minY = radius + CUBE_EDGE_PADDING + CUBE_FLOAT_AMPLITUDE;
  const maxY = Math.max(minY, height - radius - CUBE_EDGE_PADDING
    - CUBE_FLOAT_AMPLITUDE - CUBE_CAPTION_CLEARANCE);
  const x = Number.isFinite(center.x) ? center.x : width / 2;
  const y = Number.isFinite(center.y) ? center.y : height * .65;
  return { x: Math.max(minX, Math.min(maxX, x)), y: Math.max(minY, Math.min(maxY, y)) };
}

export function isCubeDrag(origin: Point, current: Point, threshold = CUBE_DRAG_THRESHOLD) {
  return Math.hypot(current.x - origin.x, current.y - origin.y) > Math.max(0, threshold);
}

/** A cleared position docks at bottom left; only dragging overrides the resting place. */
export function cubeRestingCenter(viewport: Viewport, size: number, remembered: Point | null = null): Point {
  return clampCubeCenter(remembered ?? { x: 0, y: viewport.height }, viewport, size);
}

/** Velocity uses CSS pixels per millisecond and exponentially settles to zero. */
export function cubeMomentumStep(momentum: CubeMomentum, elapsedMs: number,
  viewport: Viewport, size: number, reducedMotion: boolean): CubeMomentum {
  if (reducedMotion) return { center: clampCubeCenter(momentum.center, viewport, size), velocity: { x: 0, y: 0 } };
  const elapsed = Math.max(0, Math.min(64, Number.isFinite(elapsedMs) ? elapsedMs : 0));
  const proposed = {
    x: momentum.center.x + momentum.velocity.x * elapsed,
    y: momentum.center.y + momentum.velocity.y * elapsed,
  };
  const center = clampCubeCenter(proposed, viewport, size);
  const damping = Math.pow(.88, elapsed / 16);
  let x = center.x === proposed.x ? momentum.velocity.x * damping : 0;
  let y = center.y === proposed.y ? momentum.velocity.y * damping : 0;
  if (Math.hypot(x, y) < .012) x = y = 0;
  return { center, velocity: { x, y } };
}

export function cubeFaceTransform(axis: CubeAxis, size: number) {
  const half = finiteSize(size) / 2;
  switch (axis) {
    case 'back': return `rotateY(180deg) translateZ(${half}px)`;
    case 'right': return `rotateY(90deg) translateZ(${half}px)`;
    case 'left': return `rotateY(-90deg) translateZ(${half}px)`;
    case 'top': return `rotateX(90deg) translateZ(${half}px)`;
    case 'bottom': return `rotateX(-90deg) translateZ(${half}px)`;
    default: return `rotateY(0deg) translateZ(${half}px)`;
  }
}

export type CubeVec = { x: number; y: number; z: number };
export type CubeMove = 'U' | 'D' | 'L' | 'R' | 'F' | 'B' | "U'" | "D'" | "L'" | "R'" | "F'" | "B'";
type Mat3 = readonly [number, number, number, number, number, number, number, number, number];

export const CUBE_IDENTITY: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
export const CUBE_CUBIES: CubeVec[] = (() => {
  const list: CubeVec[] = [];
  for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
    if (x || y || z) list.push({ x, y, z });
  }
  return list;
})();

const MOVE_FACE = {
  R: { axis: 'x' as const, layer: 1, dir: 1 as const },
  "R'": { axis: 'x' as const, layer: 1, dir: -1 as const },
  L: { axis: 'x' as const, layer: -1, dir: -1 as const },
  "L'": { axis: 'x' as const, layer: -1, dir: 1 as const },
  U: { axis: 'y' as const, layer: -1, dir: -1 as const },
  "U'": { axis: 'y' as const, layer: -1, dir: 1 as const },
  D: { axis: 'y' as const, layer: 1, dir: 1 as const },
  "D'": { axis: 'y' as const, layer: 1, dir: -1 as const },
  F: { axis: 'z' as const, layer: 1, dir: 1 as const },
  "F'": { axis: 'z' as const, layer: 1, dir: -1 as const },
  B: { axis: 'z' as const, layer: -1, dir: -1 as const },
  "B'": { axis: 'z' as const, layer: -1, dir: 1 as const },
};

function mul(a: Mat3, b: Mat3): Mat3 {
  return [
    a[0] * b[0] + a[1] * b[3] + a[2] * b[6], a[0] * b[1] + a[1] * b[4] + a[2] * b[7], a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
    a[3] * b[0] + a[4] * b[3] + a[5] * b[6], a[3] * b[1] + a[4] * b[4] + a[5] * b[7], a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
    a[6] * b[0] + a[7] * b[3] + a[8] * b[6], a[6] * b[1] + a[7] * b[4] + a[8] * b[7], a[6] * b[2] + a[7] * b[5] + a[8] * b[8],
  ];
}

function rotateAxis(axis: 'x' | 'y' | 'z', dir: 1 | -1, turns = 1): Mat3 {
  const quarter = ((dir * turns) % 4 + 4) % 4;
  const c = [1, 0, -1, 0][quarter], s = [0, 1, 0, -1][quarter];
  if (axis === 'x') return [1, 0, 0, 0, c, -s, 0, s, c];
  if (axis === 'y') return [c, 0, s, 0, 1, 0, -s, 0, c];
  return [c, -s, 0, s, c, 0, 0, 0, 1];
}

export function cubeApply(matrix: Mat3, vec: CubeVec): CubeVec {
  return {
    x: Math.round(matrix[0] * vec.x + matrix[1] * vec.y + matrix[2] * vec.z),
    y: Math.round(matrix[3] * vec.x + matrix[4] * vec.y + matrix[5] * vec.z),
    z: Math.round(matrix[6] * vec.x + matrix[7] * vec.y + matrix[8] * vec.z),
  };
}

export function cubeCubieStickers(home: CubeVec): CubeAxis[] {
  const faces: CubeAxis[] = [];
  if (home.z === 1) faces.push('front');
  if (home.z === -1) faces.push('back');
  if (home.x === 1) faces.push('right');
  if (home.x === -1) faces.push('left');
  if (home.y === -1) faces.push('top');
  if (home.y === 1) faces.push('bottom');
  return faces;
}

export function cubeMoveOf(move: string): CubeMove | null {
  return move in MOVE_FACE ? move as CubeMove : null;
}

export function cubeInvertMove(move: CubeMove): CubeMove {
  return (move.endsWith("'") ? move.slice(0, -1) : `${move}'`) as CubeMove;
}

export function cubeInvertSequence(moves: readonly CubeMove[]): CubeMove[] {
  return [...moves].reverse().map(cubeInvertMove);
}

export function cubeInLayer(home: CubeVec, orient: Mat3, move: CubeMove) {
  const def = MOVE_FACE[move];
  const pos = cubeApply(orient, home);
  return (def.axis === 'x' ? pos.x : def.axis === 'y' ? pos.y : pos.z) === def.layer;
}

export function cubeTurnMatrix(move: CubeMove, turns = 1): Mat3 {
  const def = MOVE_FACE[move];
  return rotateAxis(def.axis, def.dir, turns);
}

export function cubeApplyMove(orients: readonly Mat3[], move: CubeMove, homes: readonly CubeVec[] = CUBE_CUBIES): Mat3[] {
  const turn = cubeTurnMatrix(move);
  return orients.map((orient, index) => cubeInLayer(homes[index], orient, move) ? mul(turn, orient) : orient);
}

export function cubeScramble(count = CUBE_SCRAMBLE_MOVES, seed = 7): CubeMove[] {
  const faces: CubeMove[] = ['U', 'D', 'L', 'R', 'F', 'B'];
  let state = Number.isFinite(seed) ? seed >>> 0 : 7;
  const next = () => { state = Math.imul(state, 1664525) + 1013904223 >>> 0; return state; };
  const moves: CubeMove[] = [];
  let last = '';
  const n = Number.isFinite(count) ? Math.max(0, Math.min(24, Math.floor(count))) : 0;
  for (let i = 0; i < n; i++) {
    let face = faces[next() % 6];
    while (face === last) face = faces[next() % 6];
    last = face;
    moves.push(next() % 2 ? cubeInvertMove(face) : face);
  }
  return moves;
}

export function cubeMoveEase(progress: number) {
  const t = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  return t * t * (3 - 2 * t);
}

export function cubeComposeTurn(orient: Mat3, move: CubeMove, progress: number): Mat3 {
  const t = cubeMoveEase(progress);
  if (t === 0) return orient;
  if (t === 1) return mul(cubeTurnMatrix(move), orient);
  const def = MOVE_FACE[move];
  const angle = def.dir * t * Math.PI / 2;
  const c = Math.cos(angle), s = Math.sin(angle);
  const turn: Mat3 = def.axis === 'x' ? [1, 0, 0, 0, c, -s, 0, s, c]
    : def.axis === 'y' ? [c, 0, s, 0, 1, 0, -s, 0, c]
    : [c, -s, 0, s, c, 0, 0, 0, 1];
  return mul(turn, orient);
}

export function cubeCubieTransform(orient: Mat3, home: CubeVec, step: number) {
  const px = home.x * step, py = home.y * step, pz = home.z * step;
  const tx = orient[0] * px + orient[1] * py + orient[2] * pz;
  const ty = orient[3] * px + orient[4] * py + orient[5] * pz;
  const tz = orient[6] * px + orient[7] * py + orient[8] * pz;
  return `matrix3d(${orient[0]},${orient[3]},${orient[6]},0,${orient[1]},${orient[4]},${orient[7]},0,${orient[2]},${orient[5]},${orient[8]},0,${tx},${ty},${tz},1)`;
}

/**
 * The isometric pose (rotateX -24°, rotateY 32°) projects wider than the cube's box: about 1.38× its
 * edge. Dock math uses the projected half-width so the visible cube, not the box, lines up.
 */
export const CUBE_PROJECTED_HALF = .69;
/** Air between the cube's projected right edge and the first metric card. */
export const CUBE_STRIP_GAP = 60;
/** Width of the framed menu bay drawn around the docked cube (projected width plus air). */
export const cubeBayWidth = (size: number) => Math.round(finiteSize(size) * CUBE_PROJECTED_HALF * 2 + 24);
/** Width the top metric strip leaves free at its left end for the cube. */
export const cubeStripSpace = (size: number) => Math.round(finiteSize(size) * CUBE_PROJECTED_HALF * 2 + CUBE_STRIP_GAP);
export interface CubeAnchor { left: number; top: number; height: number }

/**
 * Fixed dock: the cube floats at the left end of the top metric strip, vertically centred on it.
 * Without a strip (scene screens) it sits in the top-left corner with the edge padding.
 */
export function cubeDockCenter(anchor: CubeAnchor | null, viewport: Viewport, size: number): Point {
  const half = finiteSize(size) / 2;
  const width = finiteSize(viewport.width), height = finiteSize(viewport.height);
  // Centre the cube in its framed bay so the air on both sides matches.
  const bayHalf = cubeBayWidth(size) / 2;
  const target = anchor && Number.isFinite(anchor.left + anchor.top + anchor.height)
    ? { x: anchor.left + bayHalf, y: anchor.top + finiteSize(anchor.height) / 2 }
    : { x: CUBE_EDGE_PADDING + bayHalf, y: CUBE_EDGE_PADDING + half };
  return { x: Math.max(half, Math.min(Math.max(half, width - half), target.x)),
    y: Math.max(half, Math.min(Math.max(half, height - half), target.y)) };
}

/** Idle showcase: every quarter turn about Y brings the next side face to the front. */
export const CUBE_SHOWCASE_EVERY_MS = 6000;
export const CUBE_SHOWCASE_TURN_MS = 1100;
/** Hold the holographic wireframe this long after mount before the sticker colours fill in. */
export const CUBE_HUD_HOLD_MS = 450;
const SHOWCASE_ORDER: readonly CubeAxis[] = ['front', 'left', 'back', 'right'];

/** Face that faces the viewer after `quarterTurns` positive rotateY quarter turns (0 = front). */
export function cubeShowcaseFace(quarterTurns: number): CubeAxis {
  const turns = Number.isFinite(quarterTurns) ? Math.round(quarterTurns) : 0;
  return SHOWCASE_ORDER[((turns % 4) + 4) % 4];
}

/** Stagger (ms) for the HUD fill so stickers light up as a wave across the cube. */
export function cubeStickerDelay(home: { x: number; y: number; z: number }) {
  return ((home.x + 1) + (home.y + 1) * 3 + (home.z + 1) * 9) * 25;
}

/**
 * Unfolded menu, laid out like a cube net around the cube's own slot (0,0): the first three faces
 * run to the right along row 0, the next three run down column 0, and the cube slot shows the
 * fold-back tile. Columns/rows describe the 4 x 4 bounding box of that L shape.
 */
export const CUBE_MENU_COLUMNS = 4;
export const CUBE_MENU_ROWS = 4;
export const CUBE_MENU_GAP = 10;
export const CUBE_MENU_ARM = 3;
export interface CubeMenuSlot {
  id: (typeof CUBE_FACES)[number]['id'];
  axis: CubeAxis;
  label: string;
  sticker: string;
  column: number;
  row: number;
  /** Fly-out order; the reverse order folds the menu back. */
  order: number;
  /** Rotation the face has on the cube, so the panel peels off from that orientation. */
  peel: string;
}

const PEEL: Record<CubeAxis, string> = {
  front: 'rotateY(0deg)', right: 'rotateY(90deg)', left: 'rotateY(-90deg)',
  back: 'rotateY(180deg)', top: 'rotateX(90deg)', bottom: 'rotateX(-90deg)',
};

export function cubeMenuSlots(): CubeMenuSlot[] {
  return CUBE_FACES.map((face, index) => {
    const right = index < CUBE_MENU_ARM;
    return {
      id: face.id, axis: face.axis, label: face.label, sticker: face.sticker,
      column: right ? index + 1 : 0, row: right ? 0 : index - CUBE_MENU_ARM + 1,
      // The fold tile takes order 0 in the cube's slot; faces follow it outward.
      order: index + 1, peel: PEEL[face.axis],
    };
  });
}

/** Menu tile edge for a cube edge: a touch larger than the cube so the icon and label read. */
export const cubeMenuTileSize = (cubeSize: number) => Math.round(finiteSize(cubeSize) * 1.15);

/** Top-left of the net: slot (0,0) is centred on the cube, pulled inside the viewport if the arms would leave it. */
export function cubeMenuOrigin(center: Point, cubeSize: number, viewport: Viewport): Point {
  const tile = cubeMenuTileSize(cubeSize);
  const width = tile * CUBE_MENU_COLUMNS + CUBE_MENU_GAP * (CUBE_MENU_COLUMNS - 1);
  const height = tile * CUBE_MENU_ROWS + CUBE_MENU_GAP * (CUBE_MENU_ROWS - 1);
  const x = Math.max(CUBE_EDGE_PADDING, Math.min(finiteSize(viewport.width) - width - CUBE_EDGE_PADDING, center.x - tile / 2));
  const y = Math.max(CUBE_EDGE_PADDING, Math.min(finiteSize(viewport.height) - height - CUBE_EDGE_PADDING, center.y - tile / 2));
  return { x, y };
}
