import { describe, expect, it } from 'vitest';
import { voiceCoreState } from '@/cinema/jarvisVoiceCore';
import { projectReactor, rotateReactorPoint } from '@/cinema/voiceReactorGeometry';
import { projectReactorRear, reactorRearMesh, reactorRearVertexPool } from '@/cinema/reactorRearGeometry';

describe('reactor rear vertex pool', () => {
  it('shares each unique vertex between the faces that meet at it', () => {
    const mesh = reactorRearMesh();
    const references = mesh.reduce((sum, part) => sum + part.faces.reduce((s, face) => s + face.vertices.length, 0), 0);
    const pool = reactorRearVertexPool();
    expect(pool.length).toBeLessThan(references / 2);
    for (const part of mesh) for (const face of part.faces) {
      expect(face.indices).toHaveLength(face.vertices.length);
      // Pool keys fold -0 into 0; numeric equality is what the projection sees.
      face.indices.forEach((index, i) => expect(pool[index].x === face.vertices[i].x && pool[index].y === face.vertices[i].y && pool[index].z === face.vertices[i].z).toBe(true));
    }
  });
  it.each([0, 2.7, 9.4])('projects exactly what per-face projection produced at %ss', seconds => {
    const state = voiceCoreState(seconds, 'speaking', .6);
    const naive = reactorRearMesh().flatMap(part => part.faces.map(face =>
      face.vertices.map(p => projectReactor(rotateReactorPoint(p, state.rotation, state.gazeYaw), state.pitch))));
    const projected = projectReactorRear(state);
    expect(projected).toHaveLength(naive.length);
    const byPart = new Map(projected.map(face => [`${face.partId}:${face.vertices.map(v => `${v.x},${v.y},${v.z}`).join('|')}`, face]));
    for (const vertices of naive) {
      const key = vertices.map(v => `${v.x},${v.y},${v.z}`).join('|');
      expect([...byPart.keys()].some(k => k.endsWith(':' + key))).toBe(true);
    }
  });
});
