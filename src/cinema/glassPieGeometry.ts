export interface GlassPiePoint { x: number; y: number; z: number }
export interface GlassPieProjection { tilt: number; distance: number }
export interface ProjectedGlassPiePoint { x: number; y: number; depth: number }

export interface GlassPieSliceGeometryOptions {
  radius: number;
  start: number;
  end: number;
  thickness: number;
  offsetX?: number;
  offsetY?: number;
  lift?: number;
  projection: GlassPieProjection;
}

export interface GlassPieSliceGeometry {
  top: ProjectedGlassPiePoint[];
  bottom: ProjectedGlassPiePoint[];
  walls: ProjectedGlassPiePoint[][];
  outerTop: ProjectedGlassPiePoint[];
  outerBottom: ProjectedGlassPiePoint[];
  center: ProjectedGlassPiePoint;
  anchor: ProjectedGlassPiePoint;
  depth: number;
}

const FULL_TURN = Math.PI * 2;
const ARC_STEP = Math.PI / 36;

/** Camera looks toward the origin from positive world Y and Z; screen Y points down. */
export function projectGlassPiePoint(point: GlassPiePoint, projection: GlassPieProjection): ProjectedGlassPiePoint {
  const cosine = Math.cos(projection.tilt), sine = Math.sin(projection.tilt);
  const depth = projection.distance - point.y * cosine - point.z * sine;
  const near = Math.max(1e-6, projection.distance * .025);
  const scale = projection.distance / Math.max(near, depth);
  return { x: point.x * scale, y: (point.y * sine - point.z * cosine) * scale, depth };
}

/** An extruded sector keeps its real angular share even while it is separated or lifted. */
export function buildGlassPieSliceGeometry(options: GlassPieSliceGeometryOptions): GlassPieSliceGeometry | null {
  const { radius, start, end, thickness, offsetX = 0, offsetY = 0, lift = 0, projection } = options;
  if (![radius, start, end, thickness, offsetX, offsetY, lift, projection.tilt, projection.distance].every(Number.isFinite)
    || radius <= 0 || thickness < 0 || projection.distance <= 0) return null;
  const requestedSpan = end - start;
  if (!Number.isFinite(requestedSpan) || requestedSpan <= 0) return null;

  const span = Math.min(FULL_TURN, requestedSpan);
  const normalizedStart = start % FULL_TURN;
  const segments = Math.max(1, Math.min(72, Math.ceil(span / ARC_STEP)));
  const project = (x: number, y: number, z: number) => projectGlassPiePoint({ x, y, z }, projection);
  const center = project(offsetX, offsetY, lift);
  const bottomCenter = project(offsetX, offsetY, lift - thickness);
  const outerTop: ProjectedGlassPiePoint[] = [];
  const outerBottom: ProjectedGlassPiePoint[] = [];

  for (let index = 0; index <= segments; index++) {
    const angle = normalizedStart + span * index / segments;
    const x = offsetX + Math.cos(angle) * radius, y = offsetY + Math.sin(angle) * radius;
    outerTop.push(project(x, y, lift));
    outerBottom.push(project(x, y, lift - thickness));
  }

  const top = [center, ...outerTop], bottom = [bottomCenter, ...outerBottom];
  const midpoint = normalizedStart + span / 2;
  const anchor = project(offsetX + Math.cos(midpoint) * radius, offsetY + Math.sin(midpoint) * radius, lift);
  const points = [...top, ...bottom, anchor];
  if (!points.every(point => Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.depth))) return null;

  const walls: ProjectedGlassPiePoint[][] = [];
  for (let index = 0; index < segments; index++) {
    walls.push([outerTop[index], outerTop[index + 1], outerBottom[index + 1], outerBottom[index]]);
  }
  // A complete disc has no cut faces; omitting them prevents a false internal glass seam.
  if (span < FULL_TURN - 1e-10) {
    walls.push([center, outerTop[0], outerBottom[0], bottomCenter]);
    walls.push([outerTop[segments], center, bottomCenter, outerBottom[segments]]);
  }

  // Divide before adding so very large but finite coordinates cannot overflow the mean.
  const depth = points.reduce((sum, point) => sum + point.depth / points.length, 0);
  if (!Number.isFinite(depth)) return null;
  return { top, bottom, walls, outerTop, outerBottom, center, anchor, depth };
}
