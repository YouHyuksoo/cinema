import { describe, expect, it } from 'vitest';
import { drivenGear, gearOutline, mainGear, TAU, type Gear } from '@/cinema/gearGeometry';

type Point = [number, number];
type Segment = [Point, Point];
const EPSILON = 1e-8;
const FOLLOWERS = [
  { name: 'output', teeth: 32, bearing: -2.55 },
  { name: 'quality', teeth: 36, bearing: 0.58 },
];

function bounds(points: Point[]) {
  return {
    left: Math.min(...points.map(([x]) => x)),
    right: Math.max(...points.map(([x]) => x)),
    top: Math.min(...points.map(([, y]) => y)),
    bottom: Math.max(...points.map(([, y]) => y)),
  };
}

function cross(a: Point, b: Point, c: Point) {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function intersects([a, b]: Segment, [c, d]: Segment) {
  const ab = bounds([a, b]);
  const cd = bounds([c, d]);
  if (ab.right < cd.left - EPSILON || cd.right < ab.left - EPSILON
    || ab.bottom < cd.top - EPSILON || cd.bottom < ab.top - EPSILON) return false;

  const oppositeSides = (first: number, second: number) =>
    (first <= EPSILON && second >= -EPSILON) || (second <= EPSILON && first >= -EPSILON);
  return oppositeSides(cross(a, b, c), cross(a, b, d))
    && oppositeSides(cross(c, d, a), cross(c, d, b));
}

function outlinesIntersect(parent: Gear, child: Gear) {
  const bearing = Math.atan2(child.y - parent.y, child.x - parent.x);
  const cos = Math.cos(bearing);
  const sin = Math.sin(bearing);
  // Rotate into the contact frame so overlapping bounds isolate the narrow contact patch.
  const project = (gear: Gear): Point[] => gearOutline(gear).map(([x, y]) => [
    (x - parent.x) * cos + (y - parent.y) * sin,
    -(x - parent.x) * sin + (y - parent.y) * cos,
  ]);
  const parentPoints = project(parent);
  const childPoints = project(child);
  const parentBounds = bounds(parentPoints);
  const childBounds = bounds(childPoints);
  const patch = {
    left: Math.max(parentBounds.left, childBounds.left),
    right: Math.min(parentBounds.right, childBounds.right),
    top: Math.max(parentBounds.top, childBounds.top),
    bottom: Math.min(parentBounds.bottom, childBounds.bottom),
  };
  const candidates = (points: Point[]): Segment[] => points
    .map((point, index): Segment => [point, points[(index + 1) % points.length]])
    .filter(([a, b]) => {
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) < EPSILON) return false;
      const edge = bounds([a, b]);
      return edge.right >= patch.left && edge.left <= patch.right
        && edge.bottom >= patch.top && edge.top <= patch.bottom;
    });
  const parentEdges = candidates(parentPoints);
  const childEdges = candidates(childPoints);
  return parentEdges.some((parentEdge) => childEdges.some((childEdge) => intersects(parentEdge, childEdge)));
}

describe.each(FOLLOWERS)('$name gear', ({ teeth, bearing }) => {
  it('keeps pitch circles tangent and tangential speeds equal with opposite rotation', () => {
    const parent = mainGear(0.7);
    const child = drivenGear(parent, teeth, bearing);
    const elapsed = 0.25;
    const nextParent = mainGear(parent.angle + 0.16 * elapsed);
    const nextChild = drivenGear(nextParent, teeth, bearing);
    const parentVelocity = (nextParent.angle - parent.angle) / elapsed;
    const childVelocity = (nextChild.angle - child.angle) / elapsed;

    expect(Math.hypot(child.x - parent.x, child.y - parent.y)).toBeCloseTo(parent.radius + child.radius, 10);
    expect(child.radius / child.teeth).toBeCloseTo(parent.radius / parent.teeth, 12);
    expect(parentVelocity * childVelocity).toBeLessThan(0);
    expect(parent.radius * parentVelocity + child.radius * childVelocity).toBeCloseTo(0, 9);
    expect(nextChild.x).toBe(child.x);
    expect(nextChild.y).toBe(child.y);
  });

  it('maintains tooth-to-gap contact phase over positive and negative rotations', () => {
    for (const angle of [-25, -0.7, 0, 0.13, 3.2, 250]) {
      const parent = mainGear(angle);
      const child = drivenGear(parent, teeth, bearing);
      const contactPhase = parent.teeth * (bearing - parent.angle)
        + child.teeth * (bearing + Math.PI - child.angle);
      expect(Math.cos(contactPhase)).toBeCloseTo(-1, 10);
      expect(Math.sin(contactPhase)).toBeCloseTo(0, 9);
    }
  });

  it('keeps tooth outlines clear across a complete main tooth period', () => {
    const initialParent = mainGear(bearing);
    const initialChild = drivenGear(initialParent, teeth, bearing);
    // A half-tooth phase error must be detected; otherwise the collision check could pass vacuously.
    expect(outlinesIntersect(initialParent, {
      ...initialChild,
      angle: initialChild.angle + Math.PI / teeth,
    })).toBe(true);

    const samples = 240;
    for (let sample = 0; sample <= samples; sample += 1) {
      const angle = bearing + (TAU / initialParent.teeth) * sample / samples;
      const parent = mainGear(angle);
      const child = drivenGear(parent, teeth, bearing);
      expect(outlinesIntersect(parent, child), `tooth outline collision at sample ${sample}/${samples}, angle ${angle}`)
        .toBe(false);
    }
  });
});
