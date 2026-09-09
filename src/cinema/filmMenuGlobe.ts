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
export const GLOBE_CAPTION_CLEARANCE = 28;
export const GLOBE_CAPTION_MAX_WIDTH = 200;
export const GLOBE_DRAG_THRESHOLD = 7;

export type Point = { x: number; y: number };
export type Viewport = { width: number; height: number };
export type GlobeMomentum = { center: Point; velocity: Point };

function finiteSize(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function globeDiameter(viewportWidth: number, viewportHeight: number) {
  const width = finiteSize(viewportWidth), height = finiteSize(viewportHeight);
  const preferred = height <= 500 ? 132 : width <= 680 ? 180 : 240;
  const horizontalFit = width - GLOBE_EDGE_PADDING * 2;
  const verticalFit = height - GLOBE_EDGE_PADDING * 2 - GLOBE_FLOAT_AMPLITUDE * 2 - GLOBE_CAPTION_CLEARANCE;
  return Math.max(0, Math.min(preferred, horizontalFit, verticalFit));
}

export function clampGlobeCenter(center: Point, viewport: Viewport, diameter: number): Point {
  const width = finiteSize(viewport.width), height = finiteSize(viewport.height);
  const radius = finiteSize(diameter) / 2;
  const captionRadius = Math.min(GLOBE_CAPTION_MAX_WIDTH / 2,
    Math.max(0, width - GLOBE_EDGE_PADDING * 2) / 2);
  const horizontalRadius = Math.max(radius, captionRadius);
  const minX = horizontalRadius + GLOBE_EDGE_PADDING;
  const maxX = Math.max(minX, width - horizontalRadius - GLOBE_EDGE_PADDING);
  const minY = radius + GLOBE_EDGE_PADDING + GLOBE_FLOAT_AMPLITUDE;
  const maxY = Math.max(minY, height - radius - GLOBE_EDGE_PADDING
    - GLOBE_FLOAT_AMPLITUDE - GLOBE_CAPTION_CLEARANCE);
  const x = Number.isFinite(center.x) ? center.x : width / 2;
  const y = Number.isFinite(center.y) ? center.y : height * .65;
  return { x: Math.max(minX, Math.min(maxX, x)), y: Math.max(minY, Math.min(maxY, y)) };
}

export function isGlobeDrag(origin: Point, current: Point, threshold = GLOBE_DRAG_THRESHOLD) {
  return Math.hypot(current.x - origin.x, current.y - origin.y) > Math.max(0, threshold);
}

/** A cleared position docks at bottom right; only dragging overrides the resting place. */
export function globeRestingCenter(viewport: Viewport, diameter: number, remembered: Point | null = null): Point {
  return clampGlobeCenter(remembered ?? { x: viewport.width, y: viewport.height }, viewport, diameter);
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

/** After the menu folds into the globe it rests at full size, then eases down to half so it stays out of the way. */
export const GLOBE_REST_DELAY_MS = 4000;
export const GLOBE_SHRINK_MS = 1400;
export const GLOBE_GROW_MS = 350;
export const GLOBE_REST_SCALE = .5;

/** Advance the 0..1 rest amount: 0 = full globe, 1 = resting size. `awake` (hover, focus, drag) always grows. */
export function globeRestStep(rest: number, idleMs: number, elapsedMs: number, awake: boolean) {
  const target = !awake && idleMs >= GLOBE_REST_DELAY_MS ? 1 : 0;
  const rate = elapsedMs / (target ? GLOBE_SHRINK_MS : GLOBE_GROW_MS);
  return Math.max(0, Math.min(1, rest + Math.sign(target - rest) * Math.min(rate, Math.abs(target - rest))));
}

/** Visual scale for a rest amount, eased so the change starts and ends softly. */
export function globeRestScale(rest: number) {
  const t = Math.max(0, Math.min(1, rest)), eased = t * t * (3 - 2 * t);
  return 1 - (1 - GLOBE_REST_SCALE) * eased;
}
