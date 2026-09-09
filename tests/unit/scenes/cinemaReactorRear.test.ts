import { describe, expect, it } from 'vitest';
import { voiceCoreState, VOICE_CORE_VIEW } from '../../../src/cinema/jarvisVoiceCore';
import { projectReactor, REACTOR_HALF, rotateReactorPoint } from '../../../src/cinema/voiceReactorGeometry';
import { reactorRearMesh, projectReactorRear } from '../../../src/cinema/reactorRearGeometry';
import { drawReactorRear } from '../../../src/cinema/components/drawReactorRear';
import { drawArcReactor } from '../../../src/cinema/components/drawVoiceReactor';

describe('mechanical reactor rear', () => {
  it('has six staggered armor plates, cooling slots, six fasteners and substantial copper pipes', () => {
    const mesh = reactorRearMesh();
    expect(mesh.filter(part => part.kind === 'armor')).toHaveLength(6);
    expect(mesh.filter(part => part.kind === 'fastener')).toHaveLength(6);
    expect(mesh.filter(part => part.kind === 'cooling-slot')).toHaveLength(18);
    const pipes = mesh.filter(part => part.kind === 'pipe');
    expect(pipes).toHaveLength(3);
    for (const pipe of pipes) expect(pipe.faces.length).toBeGreaterThan(24);
    const armorDepths = mesh.filter(part => part.kind === 'armor').map(part => Math.max(...part.faces.flatMap(face => face.vertices.map(p => p.z))));
    expect(new Set(armorDepths).size).toBeGreaterThan(1);
  });

  it('builds a raised six-sided shaft above a deep bearing and thick beveled armor', () => {
    const mesh = reactorRearMesh();
    const shaft = mesh.find(part => part.kind === 'shaft')!;
    const cap = shaft.faces.find(face => face.role === 'cap')!;
    expect(cap.vertices).toHaveLength(6);
    expect(new Set(cap.vertices.map(p => p.z)).size).toBe(1);
    expect(cap.vertices[0].z).toBeGreaterThan(REACTOR_HALF + 28);
    for (const kind of ['bearing', 'shaft', 'armor', 'fastener']) {
      for (const part of mesh.filter(item => item.kind === kind)) {
        const depths = part.faces.flatMap(face => face.vertices.map(p => p.z));
        expect(Math.max(...depths) - Math.min(...depths)).toBeGreaterThanOrEqual(4);
        expect(part.faces.some(face => face.role === 'bevel')).toBe(true);
      }
    }
  });

  it('projects finite bounded vertices across rear yaw and pitch, sorted far to near', () => {
    for (const gazeYaw of [Math.PI / 2 + .01, 2.4, Math.PI, 3.8, Math.PI * 1.5 - .01]) {
      for (const pitch of [-.48, 0, .48]) {
        const faces = projectReactorRear({ ...voiceCoreState(3, 'idle', 0), gazeYaw, pitch });
        expect(faces.length).toBeGreaterThan(100);
        for (let i = 0; i < faces.length; i++) {
          if (i) expect(faces[i - 1].depth).toBeGreaterThanOrEqual(faces[i].depth);
          for (const p of faces[i].vertices) {
            expect(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)).toBe(true);
            expect(Math.abs(p.x - VOICE_CORE_VIEW.x)).toBeLessThan(150);
            expect(Math.abs(p.y - VOICE_CORE_VIEW.y)).toBeLessThan(150);
          }
        }
      }
    }
  });

  it('attaches every part to the same body rotation and stays stable in reduced motion', () => {
    const state = { ...voiceCoreState(4, 'idle', 0), gazeYaw: 2.7, pitch: -.3 };
    const original = reactorRearMesh().find(part => part.kind === 'shaft')!.faces.find(face => face.role === 'cap')!;
    const projected = projectReactorRear(state).find(face => face.partId === 'shaft' && face.role === 'cap')!;
    expect(projected.vertices).toEqual(original.vertices.map(p => projectReactor(rotateReactorPoint(p, state.rotation, state.gazeYaw), state.pitch)));
    expect(projectReactorRear(voiceCoreState(0, 'idle', 0, true))).toEqual(projectReactorRear(voiceCoreState(100, 'idle', 1, true)));
  });

  it('restores canvas state after rendering, including a failed fill', () => {
    for (const fail of [false, true]) {
      const stack: Array<{ globalAlpha: number; fillStyle: string; globalCompositeOperation: string }> = [];
      const canvas = {
        globalAlpha: .37, fillStyle: '#123456', globalCompositeOperation: 'lighter',
        save() { stack.push({ globalAlpha: this.globalAlpha, fillStyle: this.fillStyle, globalCompositeOperation: this.globalCompositeOperation }); },
        restore() { Object.assign(this, stack.pop()); },
        beginPath() {}, moveTo() {}, lineTo() {}, closePath() {},
        fill() { if (fail) throw new Error('paint failure'); },
      };
      const render = () => drawReactorRear(canvas as unknown as CanvasRenderingContext2D, { ...voiceCoreState(0, 'idle', 0), gazeYaw: Math.PI });
      if (fail) expect(render).toThrow('paint failure'); else render();
      expect(canvas.globalAlpha).toBe(.37);
      expect(canvas.fillStyle).toBe('#123456');
      expect(canvas.globalCompositeOperation).toBe('lighter');
      expect(stack).toHaveLength(0);
    }
  });

  it('keeps the projected shaft silhouette on both sides of the rear-facing threshold', () => {
    for (const gazeYaw of [-Math.PI / 2 + .02, -Math.PI / 2 - .02]) {
      const state = { ...voiceCoreState(0, 'idle', 0), gazeYaw, pitch: 0 };
      const filled: Array<{ vertices: number[][]; color: unknown }> = [];
      let path: number[][] = [];
      const gradient = { addColorStop() {} };
      const canvas = {
        fillStyle: '' as unknown,
        save() {}, restore() {}, clip() {}, stroke() {}, closePath() {}, fillRect() {},
        createLinearGradient() { return gradient; }, createRadialGradient() { return gradient; },
        beginPath() { path = []; },
        moveTo(x: number, y: number) { path.push([x, y]); },
        lineTo(x: number, y: number) { path.push([x, y]); },
        fill() { filled.push({ vertices: path.slice(), color: this.fillStyle }); },
      };
      drawArcReactor(canvas as unknown as CanvasRenderingContext2D, state);
      const cap = projectReactorRear(state).find(face => face.partId === 'shaft' && face.role === 'cap')!;
      const capVertices = cap.vertices.map(p => [p.x, p.y]);
      const capIndex = filled.findIndex(face => JSON.stringify(face.vertices) === JSON.stringify(capVertices));
      expect(capIndex).toBeGreaterThanOrEqual(0);
      const bodyIndex = filled.findIndex(face => face.color === '#09131e');
      // The opaque body covers the rear prepass from the front; rear-facing parts cover the body.
      if (Math.cos(gazeYaw) >= 0) expect(capIndex).toBeLessThan(bodyIndex);
      else expect(capIndex).toBeGreaterThan(bodyIndex);
    }
  });
});
