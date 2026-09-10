import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { voiceCoreState } from '@/cinema/jarvisVoiceCore';
import { projectReactor, reactorDiscPoint, REACTOR_HALF } from '@/cinema/voiceReactorGeometry';
import { projectReactorRear, reactorRearMesh, type ProjectedRearFace } from '@/cinema/reactorRearGeometry';

const TAU = Math.PI * 2;
type P = { x: number; y: number };
/** Ray-casting point-in-polygon on the projected body disc. */
const inside = (polygon: P[], p: P) => {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
};
const key = (face: ProjectedRearFace) => `${face.partId}:${face.vertices.map(v => `${v.x},${v.y}`).join('|')}`;

describe('reactor rear budget', () => {
  it('keeps the rear under 800 faces', () => {
    expect(reactorRearMesh().reduce((sum, part) => sum + part.faces.length, 0)).toBeLessThan(800);
  });
  it.each([0, 1.3, 4.8, 7.2])('skips only faces the opaque body disc covers, at %ss', seconds => {
    const state = voiceCoreState(seconds, 'idle', 0);
    const all = projectReactorRear(state), visible = projectReactorRear(state, true);
    const disc = Array.from({ length: 64 }, (_, i) =>
      projectReactor(reactorDiscPoint(i / 64 * TAU, 106, REACTOR_HALF, state.rotation, state.gazeYaw), state.pitch));
    expect(visible.length).toBeGreaterThan(0);
    expect(visible.length).toBeLessThan(all.length * .35);
    const kept = new Set(visible.map(key));
    for (const face of all) {
      if (kept.has(key(face))) continue;
      for (const vertex of face.vertices) expect(inside(disc, vertex)).toBe(true);
    }
    // Depth order is preserved among the faces that remain.
    for (let i = 1; i < visible.length; i++) expect(visible[i - 1].depth).toBeGreaterThanOrEqual(visible[i].depth);
  });
  it('lets the body occlude the rear only when the rear is drawn underneath it', () => {
    const source = readFileSync('src/cinema/components/drawVoiceReactor.ts', 'utf8');
    expect(source).toContain('if (!rearFacing) drawReactorRear(ctx, state, true);');
    expect(source).toContain('    drawReactorRear(ctx, state);\n    return;');
  });
});
