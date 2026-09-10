import type { VoiceCoreState } from './jarvisVoiceCore';
import { reactorProjector, reactorRotator, REACTOR_HALF, type ReactorPoint } from './voiceReactorGeometry';

type RearKind = 'housing' | 'bearing' | 'shaft' | 'armor' | 'cooling-slot' | 'pipe' | 'fastener' | 'indicator';
type RearMaterial = 'gunmetal' | 'silver' | 'copper' | 'recess' | 'cyan';
type FaceRole = 'cap' | 'bevel' | 'wall';
export interface RearFace { vertices: ReactorPoint[]; indices: number[]; material: RearMaterial; role: FaceRole }
export interface RearPart { id: string; kind: RearKind; faces: RearFace[] }
/** Faces as the builders emit them; the shared vertex pool assigns `indices` afterwards. */
type RawFace = Omit<RearFace, 'indices'>;
type RawPart = Omit<RearPart, 'faces'> & { faces: RawFace[] };
export interface ProjectedRearFace extends RearFace { partId: string; depth: number; light: number }

const TAU = Math.PI * 2;
const BACK = REACTOR_HALF;
const point = (radius: number, angle: number, z: number): ReactorPoint => ({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, z });

/** A band is a real surface between two radius/depth pairs, including vertical walls. */
function band(outer: number, inner: number, zOuter: number, zInner: number, start: number, end: number,
  material: RearMaterial, role: FaceRole, steps = 40): RawFace[] {
  const count = Math.max(2, Math.ceil((end - start) / TAU * steps));
  return Array.from({ length: count }, (_, index) => {
    const a = start + (end - start) * index / count, b = start + (end - start) * (index + 1) / count;
    return { material, role, vertices: [point(outer, a, zOuter), point(outer, b, zOuter), point(inner, b, zInner), point(inner, a, zInner)] };
  });
}

function bearing(id: string, outer: number, inner: number, bottom: number, top: number): RawPart {
  return { id, kind: 'bearing', faces: [
    ...band(outer, outer, bottom, top - 2, 0, TAU, 'gunmetal', 'wall'),
    ...band(outer, outer - 2, top - 2, top, 0, TAU, 'silver', 'bevel'),
    ...band(outer - 2, inner + 2, top, top, 0, TAU, 'silver', 'cap'),
    ...band(inner + 2, inner, top, top - 2, 0, TAU, 'gunmetal', 'bevel'),
    ...band(inner, inner, top - 2, bottom, 0, TAU, 'recess', 'wall'),
  ] };
}

function hexagon(id: string, kind: 'shaft' | 'fastener', x: number, y: number, radius: number, bottom: number, top: number): RawPart {
  const loop = (r: number, z: number) => Array.from({ length: 6 }, (_, i) => {
    const p = point(r, i / 6 * TAU + Math.PI / 6, z);
    return { x: x + p.x, y: y + p.y, z };
  });
  const bevel = kind === 'shaft' ? 3 : 1.1;
  const lower = loop(radius, bottom), upper = loop(radius, top - bevel), cap = loop(radius - bevel, top);
  const faces: RawFace[] = [{ vertices: cap, material: 'silver', role: 'cap' }];
  for (let i = 0; i < 6; i++) {
    const j = (i + 1) % 6;
    faces.push({ vertices: [lower[i], lower[j], upper[j], upper[i]], material: 'gunmetal', role: 'wall' });
    faces.push({ vertices: [upper[i], upper[j], cap[j], cap[i]], material: 'silver', role: 'bevel' });
  }
  // Recessed hex socket on the bolt head; the large central shaft remains solid.
  if (kind === 'fastener') faces.push({ vertices: loop(radius * .4, top + .05), material: 'recess', role: 'cap' });
  return { id, kind, faces };
}

function armor(index: number): RawPart[] {
  const start = index * TAU / 6 + .07, end = (index + 1) * TAU / 6 - .07;
  const bottom = BACK + 2, top = BACK + (index % 2 ? 18 : 14);
  const faces: RawFace[] = [
    ...band(95, 95, bottom, top - 2, start, end, 'gunmetal', 'wall'),
    ...band(95, 92, top - 2, top, start, end, 'silver', 'bevel'),
    ...band(50, 47, top, top - 3, start, end, 'silver', 'bevel'),
    ...band(47, 47, top - 3, bottom, start, end, 'recess', 'wall'),
  ];
  // Leave openings in the top surface so the slot floors really sit below the armor.
  for (const [inner, outer] of [[50, 60], [64, 69], [73, 78], [82, 92]]) {
    faces.push(...band(outer, inner, top, top, start, end, 'gunmetal', 'cap'));
  }
  for (const angle of [start, end]) faces.push({ material: 'gunmetal', role: 'wall', vertices: [
    point(47, angle, bottom), point(95, angle, bottom), point(95, angle, top - 2),
    point(92, angle, top), point(50, angle, top), point(47, angle, top - 3),
  ] });
  const slots = [60, 69, 78].map((inner, slot): RawPart => ({
    id: `slot-${index}-${slot}`, kind: 'cooling-slot', faces: [
      ...band(inner + 4, inner, top - 3, top - 3, start, end, 'recess', 'cap'),
      ...band(inner + 4, inner + 4, top, top - 3, start, end, 'recess', 'wall'),
      ...band(inner, inner, top - 3, top, start, end, 'silver', 'wall'),
    ],
  }));
  return [{ id: `armor-${index}`, kind: 'armor', faces }, ...slots];
}

/** Three curved copper coolant feeds have an eight-sided, 9px diameter tube. */
function pipe(index: number): RawPart {
  const angle = index * TAU / 3 + .02, segments = 12, sides = 8, radius = 4.5;
  const centers = Array.from({ length: segments + 1 }, (_, step) => {
    const t = step / segments;
    return point(38 + 49 * t, angle + Math.sin(t * Math.PI) * .22, BACK + 19 + Math.sin(t * Math.PI) * 6);
  });
  const loops = centers.map((center, i) => {
    const before = centers[Math.max(0, i - 1)], after = centers[Math.min(segments, i + 1)];
    const dx = after.x - before.x, dy = after.y - before.y, planar = Math.hypot(dx, dy);
    return Array.from({ length: sides }, (_, side) => {
      const a = side / sides * TAU;
      return { x: center.x - dy / planar * Math.cos(a) * radius,
        y: center.y + dx / planar * Math.cos(a) * radius, z: center.z + Math.sin(a) * radius };
    });
  });
  const faces: RawFace[] = [];
  for (let segment = 0; segment < segments; segment++) for (let side = 0; side < sides; side++) {
    const next = (side + 1) % sides;
    faces.push({ material: 'copper', role: 'wall', vertices: [loops[segment][side], loops[segment][next], loops[segment + 1][next], loops[segment + 1][side]] });
  }
  faces.push({ vertices: loops[0], material: 'silver', role: 'cap' }, { vertices: loops[segments], material: 'silver', role: 'cap' });
  return { id: `pipe-${index}`, kind: 'pipe', faces };
}

function buildMesh(): RawPart[] {
  const parts: RawPart[] = [{ id: 'housing', kind: 'housing', faces: [
    ...band(106, 0, BACK + .1, BACK + .1, 0, TAU, 'recess', 'cap'),
    ...band(106, 106, BACK, BACK + 4, 0, TAU, 'gunmetal', 'wall'),
    ...band(106, 103, BACK + 4, BACK + 6, 0, TAU, 'silver', 'bevel'),
    ...band(103, 98, BACK + 6, BACK + 6, 0, TAU, 'gunmetal', 'cap'),
  ] }];
  for (let i = 0; i < 6; i++) {
    parts.push(...armor(i));
    const center = point(88, (i + .5) / 6 * TAU, 0);
    const top = BACK + (i % 2 ? 18 : 14);
    parts.push(hexagon(`fastener-${i}`, 'fastener', center.x, center.y, 5.8, top, top + 5));
    parts.push({ id: `indicator-${i}`, kind: 'indicator', faces: band(99, 97, BACK + 6.2, BACK + 6.2,
      i / 6 * TAU + .37, i / 6 * TAU + .41, 'cyan', 'cap') });
  }
  for (let i = 0; i < 3; i++) parts.push(pipe(i));
  parts.push(bearing('bearing', 45, 25, BACK + 2, BACK + 23));
  parts.push(hexagon('shaft', 'shaft', 0, 0, 21, BACK + 5, BACK + 39));
  return parts;
}

// Adjacent faces meet at the same points; pool them so a frame projects each vertex once.
const POOL: ReactorPoint[] = [];
function pool(parts: RawPart[]): RearPart[] {
  const known = new Map<string, number>();
  return parts.map(part => ({ ...part, faces: part.faces.map(face => ({ ...face, indices: face.vertices.map(p => {
    const key = `${p.x},${p.y},${p.z}`;
    let index = known.get(key);
    if (index === undefined) { index = POOL.length; POOL.push(p); known.set(key, index); }
    return index;
  }) })) }));
}
// The rear is manufactured geometry: no audio scaling, random detail or independent spin.
const MESH = pool(buildMesh());
export function reactorRearMesh(): readonly RearPart[] { return MESH; }
export function reactorRearVertexPool(): readonly ReactorPoint[] { return POOL; }

export function projectReactorRear(state: Pick<VoiceCoreState, 'rotation' | 'gazeYaw' | 'pitch'>): ProjectedRearFace[] {
  const rotate = reactorRotator(state.rotation, state.gazeYaw), project = reactorProjector(state.pitch);
  const screen = POOL.map(p => project(rotate(p)));
  const faces = MESH.flatMap(part => part.faces.map(face => {
    const vertices = face.indices.map(index => screen[index]);
    const [a, b, c] = vertices;
    const u = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
    const v = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
    const normal = { x: u.y * v.z - u.z * v.y, y: u.z * v.x - u.x * v.z, z: u.x * v.y - u.y * v.x };
    const length = Math.hypot(normal.x, normal.y, normal.z) || 1;
    const light = .45 + .55 * Math.abs((normal.x * -.35 + normal.y * -.6 + normal.z * -.72) / length);
    return { ...face, vertices, partId: part.id, depth: vertices.reduce((sum, p) => sum + p.z, 0) / vertices.length, light };
  }));
  return faces.sort((a, b) => b.depth - a.depth);
}
