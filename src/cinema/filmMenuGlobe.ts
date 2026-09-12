export type MenuPose = {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch?: number;
  scale: number;
  opacity: number;
};

const TAU = Math.PI * 2;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const DEGREES = 180 / Math.PI;
export const GLOBE_EDGE_PADDING = 16;
export const GLOBE_FLOAT_AMPLITUDE = 4;
/** Bottom clearance under the sphere; the turbine's small-screen bottom offset mirrors it (filmTurbineMenu.module.css). */
export const GLOBE_CAPTION_CLEARANCE = 28;
export const GLOBE_DRAG_THRESHOLD = 7;

export type Point = { x: number; y: number };
export type Viewport = { width: number; height: number };
export type GlobeMomentum = { center: Point; velocity: Point };

function finiteSize(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function globeDiameter(viewportWidth: number, viewportHeight: number) {
  const width = finiteSize(viewportWidth), height = finiteSize(viewportHeight);
  // Scale with the viewport (26% of its width, 30% of its height) between 120px and 240px, so a
  // smaller window shrinks the globe proportionally instead of jumping at two breakpoints.
  const preferred = Math.round(Math.max(120, Math.min(240, width * .26, height * .3)));
  const horizontalFit = width - GLOBE_EDGE_PADDING * 2;
  const verticalFit = height - GLOBE_EDGE_PADDING * 2 - GLOBE_FLOAT_AMPLITUDE * 2 - GLOBE_CAPTION_CLEARANCE;
  return Math.max(0, Math.min(preferred, horizontalFit, verticalFit));
}

/** The turbine art is drawn on a 300px plate; folded it shows at .72 of that (filmTurbineMenu.module.css). */
export const TURBINE_ART_SIZE = 300;
export const TURBINE_FOLDED_SCALE = .72;
/**
 * The folded rotor (five furled blades around the hub, tilted 40°) fills about three quarters of its plate
 * (measured 182×145 on a 216px plate), so matching the globe by plate size makes it look too small.
 */
export const TURBINE_FOLDED_EXTENT = .75;
/** Small screens tuck the turbine into the corner: its box sits this far from the left edge (filmTurbineMenu.module.css). */
export const TURBINE_CORNER_INSET = 6;

/**
 * Small screens: the folded turbine's visible rotor takes the globe's resting size (half the layout
 * diameter) so the two corners read alike, and the open turbine grows toward the globe's awake size
 * (70%) but never past the point where its blades would leave the left edge (the hub sits
 * TURBINE_CORNER_INSET + radius from it). `diameter` is the layout diameter from globeDiameter().
 */
export function turbineOrbMetrics(diameter: number) {
  const resting = finiteSize(diameter) * GLOBE_REST_SCALE;
  const visiblePlate = TURBINE_ART_SIZE * TURBINE_FOLDED_EXTENT;
  const scale = resting / visiblePlate;
  const awake = finiteSize(diameter) * GLOBE_AWAKE_SCALE / visiblePlate;
  const edgeLimit = (TURBINE_CORNER_INSET + resting / 2) / (TURBINE_ART_SIZE / 2);
  return { diameter: resting, scale, openScale: Math.max(scale, Math.min(awake, edgeLimit)) };
}

/** Small screens (the turbine's media query: width ≤ 680 or height ≤ 480) tuck both orbs into their corners. */
export const GLOBE_TIGHT_MAX_WIDTH = 680;
export const GLOBE_TIGHT_MAX_HEIGHT = 480;
export const GLOBE_TIGHT_INSET = 6;
export const isTightViewport = (viewport: Viewport) => viewport.width <= GLOBE_TIGHT_MAX_WIDTH || viewport.height <= GLOBE_TIGHT_MAX_HEIGHT;

export function clampGlobeCenter(center: Point, viewport: Viewport, diameter: number): Point {
  const width = finiteSize(viewport.width), height = finiteSize(viewport.height);
  const radius = finiteSize(diameter) / 2;
  // No caption hangs off the globe any more, so only the sphere itself keeps the edge. Desktop keeps the
  // 16px edge and 28px bottom clearance; small screens sit 6px from the right and bottom (plus the float).
  const tight = isTightViewport({ width, height });
  const edge = tight ? GLOBE_TIGHT_INSET : GLOBE_EDGE_PADDING;
  const bottom = tight ? GLOBE_TIGHT_INSET : GLOBE_EDGE_PADDING + GLOBE_CAPTION_CLEARANCE;
  const minX = radius + edge;
  const maxX = Math.max(minX, width - radius - edge);
  const minY = radius + edge + GLOBE_FLOAT_AMPLITUDE;
  const maxY = Math.max(minY, height - radius - bottom - GLOBE_FLOAT_AMPLITUDE);
  const x = Number.isFinite(center.x) ? center.x : width / 2;
  const y = Number.isFinite(center.y) ? center.y : height * .65;
  return { x: Math.max(minX, Math.min(maxX, x)), y: Math.max(minY, Math.min(maxY, y)) };
}

export function isGlobeDrag(origin: Point, current: Point, threshold = GLOBE_DRAG_THRESHOLD) {
  return Math.hypot(current.x - origin.x, current.y - origin.y) > Math.max(0, threshold);
}

/**
 * A cleared position docks at bottom right; only dragging overrides the resting place.
 * `dockX` (the top signal bay's centerline, published as --hatchery-signal-cx) replaces the
 * right edge when the main screen shows its scanner, so the sphere rests on that axis.
 */
export function globeRestingCenter(viewport: Viewport, diameter: number, remembered: Point | null = null, previousViewport?: Viewport, dockX: number | null = null, dockY: number | null = null): Point {
  const resized = previousViewport && (previousViewport.width !== viewport.width || previousViewport.height !== viewport.height);
  const fallback = { x: Number.isFinite(dockX) ? dockX as number : viewport.width, y: Number.isFinite(dockY) ? dockY as number : viewport.height };
  return clampGlobeCenter((resized ? null : remembered) ?? fallback, viewport, diameter);
}

/** Velocity uses CSS pixels per millisecond and exponentially settles to zero. */
export function globeMomentumStep(momentum: GlobeMomentum, elapsedMs: number,
  viewport: Viewport, diameter: number, reducedMotion: boolean): GlobeMomentum {
  if (reducedMotion) return { center: clampGlobeCenter(momentum.center, viewport, diameter), velocity: { x: 0, y: 0 } };
  const elapsed = Math.max(0, Math.min(64, Number.isFinite(elapsedMs) ? elapsedMs : 0));
  const proposed = {
    x: momentum.center.x + momentum.velocity.x * elapsed,
    y: momentum.center.y + momentum.velocity.y * elapsed,
  };
  const center = clampGlobeCenter(proposed, viewport, diameter);
  const damping = Math.pow(.88, elapsed / 16);
  let x = center.x === proposed.x ? momentum.velocity.x * damping : 0;
  let y = center.y === proposed.y ? momentum.velocity.y * damping : 0;
  if (Math.hypot(x, y) < .012) x = y = 0;
  return { center, velocity: { x, y } };
}

function validCount(count: number) {
  return Number.isSafeInteger(count) && count > 0;
}

function safeRadius(radius: number) {
  return Number.isFinite(radius) ? Math.max(0, radius) : 0;
}

function unitPoint(index: number, count: number, angle: number) {
  const y = 1 - 2 * ((index + .5) / count);
  const theta = index * GOLDEN_ANGLE + angle;
  const horizontal = Math.sqrt(Math.max(0, 1 - y * y));
  return { x: horizontal * Math.sin(theta), y, z: horizontal * Math.cos(theta) };
}

/**
 * CSS coordinates on a Fibonacci sphere; yaw/pitch are degrees for
 * rotateY(yaw) rotateX(pitch), whose front normal points out of the sphere.
 * Invalid counts produce a hidden origin pose. Finite indices are floored and
 * wrapped; nonfinite index/angle and invalid radii become zero.
 */
export function globePose(index: number, count: number, radius: number, angleRadians: number): Required<MenuPose> {
  if (!validCount(count)) return { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, scale: 0, opacity: 0 };
  const slot = Number.isFinite(index) ? ((Math.floor(index) % count) + count) % count : 0;
  const angle = Number.isFinite(angleRadians) ? angleRadians % TAU : 0;
  const unit = unitPoint(slot, count, angle);
  const size = safeRadius(radius);
  return {
    x: unit.x * size, y: unit.y * size, z: unit.z * size,
    yaw: Math.atan2(unit.x, unit.z) * DEGREES,
    pitch: -Math.asin(unit.y) * DEGREES,
    scale: 1,
    opacity: .35 + (unit.z + 1) / 2 * .65,
  };
}

/**
 * Common enclosing face diameter, leaving at least 25% of the closest center
 * distance empty. Compute/memoize once per count/radius, outside animation RAF.
 * A singleton uses 75% of radius; empty/invalid geometry has zero diameter.
 */
export function globeFaceSize(count: number, radius: number) {
  const size = safeRadius(radius);
  if (!validCount(count) || size === 0) return 0;
  if (count === 1) return size * .75;
  const points = Array.from({ length: count }, (_, index) => unitPoint(index, count, 0));
  let nearest = 2;
  for (let i = 0; i < count; i++) for (let j = i + 1; j < count; j++) {
    nearest = Math.min(nearest, Math.hypot(
      points[i].x - points[j].x, points[i].y - points[j].y, points[i].z - points[j].z,
    ));
  }
  return Math.min(Number.MAX_VALUE, size * (nearest * .75));
}

function mixAngle(from: number, to: number, progress: number) {
  const delta = ((to - from) % 360 + 540) % 360 - 180;
  return from + delta * progress;
}

/** Progress is clamped; NaN starts at zero. Pose components must be finite. */
export function mixMenuPose(from: MenuPose, to: MenuPose, progress: number): Required<MenuPose> {
  const t = Number.isNaN(progress) ? 0 : Math.max(0, Math.min(1, progress));
  if (t === 0) return { ...from, pitch: from.pitch ?? 0 };
  if (t === 1) return { ...to, pitch: to.pitch ?? 0 };
  const mix = (a: number, b: number) => a * (1 - t) + b * t;
  return {
    x: mix(from.x, to.x), y: mix(from.y, to.y), z: mix(from.z, to.z),
    yaw: mixAngle(from.yaw, to.yaw, t),
    pitch: mixAngle(from.pitch ?? 0, to.pitch ?? 0, t),
    scale: mix(from.scale, to.scale), opacity: mix(from.opacity, to.opacity),
  };
}

/** The folded corner instruments use 40% of the layout diameter. */
export const GLOBE_REST_DELAY_MS = 0;
export const GLOBE_SHRINK_MS = 280;
export const GLOBE_GROW_MS = 280;
export const GLOBE_REST_SCALE = .4;
export const GLOBE_AWAKE_SCALE = .7;

/** Advance the 0..1 rest amount: 0 = hover size, 1 = resting size. `awake` (hover, focus, drag) always grows. */
export function globeRestStep(rest: number, idleMs: number, elapsedMs: number, awake: boolean) {
  const target = !awake && idleMs >= GLOBE_REST_DELAY_MS ? 1 : 0;
  const rate = elapsedMs / (target ? GLOBE_SHRINK_MS : GLOBE_GROW_MS);
  return Math.max(0, Math.min(1, rest + Math.sign(target - rest) * Math.min(rate, Math.abs(target - rest))));
}

/** Visual scale for a rest amount, eased so the change starts and ends softly. */
export function globeRestScale(rest: number) {
  const t = Math.max(0, Math.min(1, rest)), eased = t * t * (3 - 2 * t);
  return GLOBE_AWAKE_SCALE - (GLOBE_AWAKE_SCALE - GLOBE_REST_SCALE) * eased;
}

const PHI = (1 + Math.sqrt(5)) / 2;

function asUnit(x: number, y: number, z: number) {
  const length = Math.hypot(x, y, z) || 1;
  return { x: x / length, y: y / length, z: z / length };
}

function icosahedronVertices() {
  return [
    [0, 1, PHI], [0, -1, PHI], [0, 1, -PHI], [0, -1, -PHI],
    [1, PHI, 0], [-1, PHI, 0], [1, -PHI, 0], [-1, -PHI, 0],
    [PHI, 0, 1], [-PHI, 0, 1], [PHI, 0, -1], [-PHI, 0, -1],
  ].map(([x, y, z]) => asUnit(x, y, z));
}

function icosahedronFaces(verts: readonly { x: number; y: number; z: number }[]) {
  let edge = Infinity;
  for (let i = 0; i < verts.length; i++) for (let j = i + 1; j < verts.length; j++) {
    edge = Math.min(edge, Math.hypot(verts[i].x - verts[j].x, verts[i].y - verts[j].y, verts[i].z - verts[j].z));
  }
  const slack = edge * .08;
  const faces: [number, number, number][] = [];
  for (let i = 0; i < verts.length; i++) for (let j = i + 1; j < verts.length; j++) {
    if (Math.abs(Math.hypot(verts[i].x - verts[j].x, verts[i].y - verts[j].y, verts[i].z - verts[j].z) - edge) > slack) continue;
    for (let k = j + 1; k < verts.length; k++) {
      const ik = Math.hypot(verts[i].x - verts[k].x, verts[i].y - verts[k].y, verts[i].z - verts[k].z);
      const jk = Math.hypot(verts[j].x - verts[k].x, verts[j].y - verts[k].y, verts[j].z - verts[k].z);
      if (Math.abs(ik - edge) > slack || Math.abs(jk - edge) > slack) continue;
      faces.push([i, j, k]);
    }
  }
  return faces;
}

const ICOSA_VERTS = icosahedronVertices();
const ICOSA_FACES = icosahedronFaces(ICOSA_VERTS);
const SOCCER_HEX_DIRS = ICOSA_FACES.map(([a, b, c]) => asUnit(
  ICOSA_VERTS[a].x + ICOSA_VERTS[b].x + ICOSA_VERTS[c].x,
  ICOSA_VERTS[a].y + ICOSA_VERTS[b].y + ICOSA_VERTS[c].y,
  ICOSA_VERTS[a].z + ICOSA_VERTS[b].z + ICOSA_VERTS[c].z,
));

function rotateY(point: { x: number; y: number; z: number }, angle: number) {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  return { x: point.x * cos + point.z * sin, y: point.y, z: -point.x * sin + point.z * cos };
}

function lerpUnit(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }, t: number) {
  return asUnit(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
}

function orderAround(axis: { x: number; y: number; z: number }, points: { x: number; y: number; z: number }[]) {
  const hint = Math.abs(axis.y) < .9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
  const tangent = asUnit(axis.y * hint.z - axis.z * hint.y, axis.z * hint.x - axis.x * hint.z, axis.x * hint.y - axis.y * hint.x);
  const bitangent = asUnit(axis.y * tangent.z - axis.z * tangent.y, axis.z * tangent.x - axis.x * tangent.z,
    axis.x * tangent.y - axis.y * tangent.x);
  return [...points].sort((left, right) => {
    const angleOf = (point: { x: number; y: number; z: number }) => Math.atan2(
      point.x * bitangent.x + point.y * bitangent.y + point.z * bitangent.z,
      point.x * tangent.x + point.y * tangent.y + point.z * tangent.z,
    );
    return angleOf(left) - angleOf(right);
  });
}

const SOCCER_INSET = .34;

function soccerCycles() {
  const adj: number[][] = ICOSA_VERTS.map(() => []);
  for (const [a, b, c] of ICOSA_FACES) {
    const link = (i: number, j: number) => { if (!adj[i].includes(j)) adj[i].push(j); };
    link(a, b); link(b, a); link(b, c); link(c, b); link(c, a); link(a, c);
  }
  return [
    ...ICOSA_VERTS.map((vertex, index) => orderAround(vertex, adj[index].map(other => lerpUnit(vertex, ICOSA_VERTS[other], 1 / 3)))),
    ...ICOSA_FACES.map(([a, b, c]) => {
      const loop = [a, b, c];
      const hex: { x: number; y: number; z: number }[] = [];
      for (let i = 0; i < 3; i++) {
        const from = ICOSA_VERTS[loop[i]], to = ICOSA_VERTS[loop[(i + 1) % 3]];
        hex.push(lerpUnit(from, to, 1 / 3), lerpUnit(from, to, 2 / 3));
      }
      return hex;
    }),
  ];
}

function uniqueEdges(cycles: { x: number; y: number; z: number }[][]) {
  const unique = new Map<string, { a: { x: number; y: number; z: number }; b: { x: number; y: number; z: number } }>();
  for (const cycle of cycles) {
    for (let i = 0; i < cycle.length; i++) {
      const a = cycle[i], b = cycle[(i + 1) % cycle.length];
      const key = [a, b].map(point => `${point.x.toFixed(5)},${point.y.toFixed(5)},${point.z.toFixed(5)}`).sort().join('|');
      unique.set(key, { a, b });
    }
  }
  return [...unique.values()];
}

function insetCycle(cycle: { x: number; y: number; z: number }[]) {
  const center = asUnit(
    cycle.reduce((sum, p) => sum + p.x, 0),
    cycle.reduce((sum, p) => sum + p.y, 0),
    cycle.reduce((sum, p) => sum + p.z, 0),
  );
  return cycle.map(point => lerpUnit(point, center, SOCCER_INSET));
}

const SOCCER_CYCLES = soccerCycles();
export const SOCCER_SEAMS = uniqueEdges(SOCCER_CYCLES);
export const SOCCER_PANELS = SOCCER_CYCLES.map(insetCycle);
export const SOCCER_INSET_SEAMS = uniqueEdges(SOCCER_PANELS);

export type SoccerSeamPose = {
  x: number; y: number; z: number;
  yaw: number; pitch: number;
  length: number; opacity: number;
};

/** Connected truncated-icosahedron seams (soccer-ball grid) on a sphere. */
export function soccerSeamPoses(radius: number, angleRadians: number): SoccerSeamPose[] {
  const size = safeRadius(radius);
  const angle = Number.isFinite(angleRadians) ? angleRadians % TAU : 0;
  if (size === 0) return SOCCER_SEAMS.map(() => ({ x: 0, y: 0, z: 0, yaw: 0, pitch: 0, length: 0, opacity: 0 }));
  return SOCCER_SEAMS.map(({ a, b }) => {
    const pa = rotateY(a, angle), pb = rotateY(b, angle);
    const ax = pa.x * size, ay = pa.y * size, az = pa.z * size;
    const bx = pb.x * size, by = pb.y * size, bz = pb.z * size;
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const length = Math.hypot(dx, dy, dz);
    const hyp = Math.hypot(dx, dz);
    return {
      x: (ax + bx) / 2, y: (ay + by) / 2, z: (az + bz) / 2,
      yaw: Math.atan2(-dz, dx) * DEGREES,
      pitch: Math.atan2(dy, hyp) * DEGREES,
      length,
      opacity: .22 + ((az + bz) / 2 / size + 1) / 2 * .78,
    };
  });
}

function clampUnit(value: number) {
  return value < -1 ? -1 : value > 1 ? 1 : value;
}

function distToArc(
  point: { x: number; y: number; z: number },
  from: { x: number; y: number; z: number },
  to: { x: number; y: number; z: number },
) {
  const cx = from.y * to.z - from.z * to.y, cy = from.z * to.x - from.x * to.z, cz = from.x * to.y - from.y * to.x;
  const nlen = Math.hypot(cx, cy, cz);
  if (nlen < 1e-8) return 1;
  const toCircle = Math.abs((point.x * cx + point.y * cy + point.z * cz) / nlen);
  const ab = Math.acos(clampUnit(from.x * to.x + from.y * to.y + from.z * to.z));
  const ap = Math.acos(clampUnit(point.x * from.x + point.y * from.y + point.z * from.z));
  const bp = Math.acos(clampUnit(point.x * to.x + point.y * to.y + point.z * to.z));
  if (ap + bp <= ab + .12) return toCircle;
  return Math.min(ap, bp);
}

export function soccerPattern(dir: { x: number; y: number; z: number }, seam = .014): 'seam' | 'cell' | 'gap' {
  const point = asUnit(dir.x, dir.y, dir.z);
  let nearest = 1;
  for (const { a, b } of SOCCER_INSET_SEAMS) {
    nearest = Math.min(nearest, distToArc(point, a, b));
    if (nearest < seam * .2) break;
  }
  if (nearest < seam) return 'seam';
  let shared = 1;
  for (const { a, b } of SOCCER_SEAMS) {
    shared = Math.min(shared, distToArc(point, a, b));
    if (shared < .04) return 'gap';
  }
  return 'cell';
}

let sphereTexture: { width: number; height: number; data: Uint8ClampedArray } | null = null;

function soccerSeamWeight(dir: { x: number; y: number; z: number }, width = .007, feather = .006) {
  const point = asUnit(dir.x, dir.y, dir.z);
  let nearest = 1;
  for (const { a, b } of SOCCER_INSET_SEAMS) {
    nearest = Math.min(nearest, distToArc(point, a, b));
    if (nearest < width * .3) break;
  }
  if (nearest >= width + feather) return 0;
  if (nearest <= width) return 1;
  return 1 - (nearest - width) / feather;
}

function soccerSphereTexture() {
  if (sphereTexture) return sphereTexture;
  const width = 512, height = 256, data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const lat = (y / (height - 1) - .5) * Math.PI, cy = Math.sin(lat), cl = Math.cos(lat);
    for (let x = 0; x < width; x++) {
      const lon = x / width * TAU;
      const weight = soccerSeamWeight({ x: cl * Math.sin(lon), y: cy, z: cl * Math.cos(lon) });
      const i = (y * width + x) * 4;
      data[i] = 255;
      data[i + 1] = 194;
      data[i + 2] = 229;
      // Cells keep a base alpha so the folded ball reads as a lit sphere, not just a seam lattice.
      data[i + 3] = Math.round(64 + weight * 150);
    }
  }
  sphereTexture = { width, height, data };
  return sphereTexture;
}

interface SphereTable {
  out: ImageData;
  /** Byte index of every pixel inside the disc. */
  index: Int32Array;
  /** Longitude of each disc pixel as a texture fraction at spin 0, plus the 1.5 wrap offset. */
  lonFrac: Float32Array;
  /** Byte offset of the texture row for each disc pixel. */
  row: Int32Array;
  light: Float32Array;
  spec: Float32Array;
  /** Rim fade multiplied into the texture alpha, which carries the seam lattice. */
  alpha: Float32Array;
}
const SPHERE_TABLE_LIMIT = 3;
const sphereTables = new Map<number, SphereTable>();

/**
 * Everything but the spin is fixed for a given size: the disc mask, each pixel's latitude row,
 * lighting and alpha. Precompute them once per size so a frame only shifts longitude and samples.
 */
function sphereTable(ctx: CanvasRenderingContext2D, size: number): SphereTable {
  const cached = sphereTables.get(size);
  if (cached) return cached;
  const tex = soccerSphereTexture(), tw = tex.width, th = tex.height;
  const radius = size / 2, count = size * size;
  const index = new Int32Array(count), lonFrac = new Float32Array(count), row = new Int32Array(count);
  const light = new Float32Array(count), spec = new Float32Array(count), alpha = new Float32Array(count);
  let n = 0;
  for (let y = 0; y < size; y++) {
    const ny = (y + .5 - radius) / radius;
    const v = Math.asin(clampUnit(ny)) / Math.PI + .5;
    const ty = Math.min(th - 1, Math.max(0, v) * th) | 0;
    for (let x = 0; x < size; x++) {
      const nx = (x + .5 - radius) / radius, d2 = nx * nx + ny * ny;
      if (d2 > 1) continue;
      const nz = Math.sqrt(1 - d2);
      index[n] = (y * size + x) * 4;
      lonFrac[n] = Math.atan2(nx, nz) / TAU + 1.5;
      row[n] = ty * tw * 4;
      // Ambient floor plus diffuse from the upper-left, and a stronger specular so the ball glows.
      light[n] = .46 + .6 * Math.max(0, nx * -.32 + ny * -.52 + nz * .79);
      spec[n] = Math.pow(Math.max(0, nz * .5 + light[n] * .5), 18) * 70;
      alpha[n] = .75 + nz * .25;
      n++;
    }
  }
  const table = { out: ctx.createImageData(size, size), index: index.subarray(0, n), lonFrac: lonFrac.subarray(0, n),
    row: row.subarray(0, n), light: light.subarray(0, n), spec: spec.subarray(0, n), alpha: alpha.subarray(0, n) };
  if (sphereTables.size >= SPHERE_TABLE_LIMIT) sphereTables.delete(sphereTables.keys().next().value!);
  sphereTables.set(size, table);
  return table;
}

/** Raster spin resolution: 0.5° steps. A 30 s revolution then rasters at most every other frame at 60 fps. */
export const SPHERE_SPIN_STEPS = 720;
/** Spin angle snapped to the raster grid; frames whose snapped angle is unchanged reuse the previous raster. */
export function sphereSpinAngle(angleRadians: number, steps = SPHERE_SPIN_STEPS) {
  if (!Number.isFinite(angleRadians)) return 0;
  const step = TAU / steps;
  return Math.round(angleRadians / step) * step % TAU;
}

/** Paint a lit sphere wrapped by inset panel outlines with gaps between cells. Spinning only shifts longitude. */
export function drawSoccerSphere(canvas: HTMLCanvasElement, cssSize: number, angleRadians: number) {
  const size = Math.max(1, Math.round(finiteSize(cssSize)));
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  if (canvas.width !== size || canvas.height !== size) { canvas.width = size; canvas.height = size; }
  const { out, index, lonFrac, row, light, spec, alpha } = sphereTable(ctx, size);
  const tex = soccerSphereTexture(), tw = tex.width, src = tex.data, pixels = out.data;
  const spin = (Number.isFinite(angleRadians) ? angleRadians : 0) / TAU;
  pixels.fill(0);
  for (let n = 0; n < index.length; n++) {
    // atan2 of the spun normal equals the pixel's own longitude plus the spin angle.
    const u = (lonFrac[n] + spin) % 1;
    const tx = Math.min(tw - 1, (u < 0 ? u + 1 : u) * tw) | 0;
    const ti = row[n] + tx * 4, i = index[n], l = light[n], s = spec[n];
    pixels[i] = Math.min(255, src[ti] * l + s);
    pixels[i + 1] = Math.min(255, src[ti + 1] * l + s);
    pixels[i + 2] = Math.min(255, src[ti + 2] * l + s);
    pixels[i + 3] = Math.min(255, src[ti + 3] * alpha[n]);
  }
  ctx.putImageData(out, 0, 0);
}

/** Hexagon-cell centers of the soccer lattice, for placing chapter hex tiles. */
export function soccerHexPoses(radius: number, angleRadians: number): Required<MenuPose>[] {
  const size = safeRadius(radius);
  const angle = Number.isFinite(angleRadians) ? angleRadians % TAU : 0;
  if (size === 0) return SOCCER_HEX_DIRS.map(() => ({ x: 0, y: 0, z: 0, yaw: 0, pitch: 0, scale: 0, opacity: 0 }));
  return SOCCER_HEX_DIRS.map(dir => {
    const unit = rotateY(dir, angle);
    return {
      x: unit.x * size, y: unit.y * size, z: unit.z * size,
      yaw: Math.atan2(unit.x, unit.z) * DEGREES,
      pitch: -Math.asin(Math.max(-1, Math.min(1, unit.y))) * DEGREES,
      scale: 1,
      opacity: .42 + (unit.z + 1) / 2 * .58,
    };
  });
}

/**
 * Screen positions for hex cells on the painted sphere. Uses the same
 * orthographic view and Y rotation as `drawSoccerSphere`, so tiles sit in the
 * drawn cells instead of a separate CSS-perspective orbit.
 */
export function soccerHexScreenPoses(radius: number, angleRadians: number): Required<MenuPose>[] {
  const size = safeRadius(radius);
  const angle = Number.isFinite(angleRadians) ? angleRadians % TAU : 0;
  return SOCCER_HEX_DIRS.map(dir => {
    const view = rotateY(dir, -angle);
    const front = view.z > .06;
    const depth = Math.max(0, view.z);
    return {
      x: view.x * size, y: view.y * size, z: 0, yaw: 0, pitch: 0,
      scale: depth,
      opacity: front ? .2 + .8 * depth : 0,
    };
  });
}

/** Shared resting corner anchors; independent of hover scale and animated DOM bounds. */
export function cornerInstrumentCenter(viewport: Viewport, side: 'left' | 'right'): Point {
  const radius = globeDiameter(viewport.width, viewport.height) * GLOBE_REST_SCALE / 2;
  return { x: side === 'left' ? radius + 16 : viewport.width - radius - 16, y: viewport.height - radius - 20 };
}
