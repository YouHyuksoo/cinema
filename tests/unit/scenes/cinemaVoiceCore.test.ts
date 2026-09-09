import { describe, expect, it } from 'vitest';
import { voiceCoreCanvasTransform, voiceCoreEnvelope, voiceCoreState, VOICE_CORE_SCALE_MAX, VOICE_CORE_VIEW } from '@/cinema/jarvisVoiceCore';
import { projectReactor, reactorDiscPoint, reactorRimGlyphs, voiceTeslaSparks } from '@/cinema/voiceReactorGeometry';
import { drawJarvisVoiceField } from '@/cinema/drawJarvisVoiceField';
import type { JarvisPhase } from '@/cinema/jarvisAudio';

const phases: JarvisPhase[] = ['idle', 'requesting', 'listening', 'thinking', 'speaking', 'error'];

describe('rotating voice reactor audio and motion contract', () => {
  it.each(['listening', 'speaking'] as const)('%s powers the reactor with actual sound energy', phase => {
    const quiet = voiceCoreState(3, phase, 0), active = voiceCoreState(3, phase, .8);
    expect(voiceTeslaSparks(quiet)).toHaveLength(0);
    expect(active.coreRadius).toBeGreaterThan(quiet.coreRadius);
    expect(active.glow).toBeGreaterThan(quiet.glow);
    expect(voiceTeslaSparks(active).length).toBeGreaterThan(0);
    expect(active.rotation).toBe(quiet.rotation);
  });
  it.each(['idle', 'thinking', 'requesting', 'error'] as const)('%s ignores stale audio and emits no sparks', phase => {
    expect(voiceCoreState(4, phase, 1)).toEqual(voiceCoreState(4, phase, 0));
    expect(voiceTeslaSparks(voiceCoreState(4, phase, 1))).toEqual([]);
  });
  it.each(phases)('reduced motion freezes %s geometry and suppresses lightning', phase => {
    const a = voiceCoreState(1, phase, 0, true), b = voiceCoreState(99, phase, 1, true);
    expect(a).toEqual(b);
    expect(voiceTeslaSparks(b)).toEqual([]);
  });
  it('uses frame-rate independent attack and slower release', () => {
    let at60 = 0, at120 = 0;
    for (let i = 0; i < 60; i++) at60 = voiceCoreEnvelope(at60, .8, 1 / 60);
    for (let i = 0; i < 120; i++) at120 = voiceCoreEnvelope(at120, .8, 1 / 120);
    expect(at60).toBeCloseTo(at120, 10);
    expect(voiceCoreEnvelope(0, 1, .1)).toBeGreaterThan(1 - voiceCoreEnvelope(1, 0, .1));
    expect(voiceCoreEnvelope(Number.NaN, Number.POSITIVE_INFINITY, 0)).toBe(0);
  });
  it('nods the reactor pitch so the gaze looks up then down', () => {
    const samples = Array.from({ length: 80 }, (_, i) => voiceCoreState(i * .4, 'idle', 0).pitch);
    expect(Math.max(...samples)).toBeGreaterThan(.38);
    expect(Math.min(...samples)).toBeLessThan(-.12);
    expect(voiceCoreState(2.4, 'idle', 0).pitch).toBe(voiceCoreState(2.4, 'speaking', 1).pitch);
    expect(voiceCoreState(2.4, 'idle', 0).pitch).not.toBe(voiceCoreState(8.1, 'idle', 0).pitch);
    const frozen = voiceCoreState(5, 'idle', 0, true);
    expect(frozen.pitch).toBe(voiceCoreState(99, 'speaking', 1, true).pitch);
    expect(frozen.pitch).toBeCloseTo(.27);
    const front = { x: 0, y: 0, z: -40 };
    expect(projectReactor(front, .32).y).toBeGreaterThan(projectReactor(front, -.08).y);
  });
  it('blinks the plasma core like an eyelid and stays open most of the time', () => {
    const samples = Array.from({ length: 400 }, (_, i) => voiceCoreState(i * .05, 'idle', 0).blink);
    expect(Math.max(...samples)).toBeGreaterThan(.9);
    expect(samples.filter(value => value < .05).length / samples.length).toBeGreaterThan(.85);
    expect(voiceCoreState(1.2, 'idle', 0).blink).toBe(voiceCoreState(1.2, 'speaking', 1).blink);
    expect(voiceCoreState(3, 'idle', 0, true).blink).toBe(0);
    expect(voiceCoreState(99, 'speaking', 1, true).blink).toBe(0);
  });
  it('shrinks with the canvas and never fills the whole stage', () => {
    const short = voiceCoreCanvasTransform(520, 180);
    const tall = voiceCoreCanvasTransform(520, 360);
    const huge = voiceCoreCanvasTransform(1400, 900);
    expect(short.scale).toBeLessThan(tall.scale);
    expect(short.scale).toBeCloseTo(180 / VOICE_CORE_VIEW.height);
    expect(tall.scale).toBe(VOICE_CORE_SCALE_MAX);
    expect(huge.scale).toBe(VOICE_CORE_SCALE_MAX);
    expect(voiceCoreCanvasTransform(520, 180, 2).scale).toBeCloseTo(short.scale * 2);
    expect(short.x + VOICE_CORE_VIEW.x * short.scale).toBeCloseTo(260);
  });
  it('sits the reactor a little higher in the stage', () => {
    expect(VOICE_CORE_VIEW.y).toBeLessThan(148);
    expect(VOICE_CORE_VIEW.y).toBeGreaterThan(120);
    expect(projectReactor({ x: 0, y: 0, z: 0 }).y).toBe(VOICE_CORE_VIEW.y);
  });
  it('inscribes alien glyphs on the rim instead of gear teeth', () => {
    const a = voiceCoreState(1.2, 'idle', 0), b = voiceCoreState(2.8, 'idle', 0);
    expect(a.collar).not.toBe(b.collar);
    const glyphs = reactorRimGlyphs(b);
    expect(glyphs.length).toBeGreaterThan(7);
    expect(glyphs.every(glyph => glyph.band === 'side')).toBe(true);
    expect(new Set(glyphs.map(glyph => glyph.kind)).size).toBeGreaterThan(6);
    expect(reactorRimGlyphs(a)[0].strokes[0][0]).not.toEqual(glyphs[0].strokes[0][0]);
    expect(reactorRimGlyphs(voiceCoreState(4, 'idle', 0, true))).toEqual(reactorRimGlyphs(voiceCoreState(40, 'speaking', 1, true)));
    for (const glyph of glyphs) {
      expect(glyph.strokes.length).toBeGreaterThan(1);
      for (const stroke of glyph.strokes) {
        expect(stroke.length).toBeGreaterThan(1);
        for (const point of stroke) {
          const radial = Math.hypot(point.x, point.y);
          expect(radial).toBeGreaterThan(88);
          expect(radial).toBeLessThan(112);
          const q = projectReactor(point, b.pitch);
          expect(Object.values(point).every(Number.isFinite)).toBe(true);
          expect(q.x).toBeGreaterThan(0); expect(q.x).toBeLessThan(VOICE_CORE_VIEW.width);
          expect(q.y).toBeGreaterThan(0); expect(q.y).toBeLessThan(VOICE_CORE_VIEW.height);
        }
      }
    }
  });
  it('rotates the reactor itself while preserving thickness and viewport bounds', () => {
    expect(projectReactor({ x: 100, y: 0, z: -100 }).x).toBeGreaterThan(projectReactor({ x: 100, y: 0, z: 100 }).x);
    expect(reactorDiscPoint(0, 100, -25, 0)).not.toEqual(reactorDiscPoint(0, 100, -25, 1));
    for (let step = 0; step < 64; step++) {
      for (let i = 0; i < 32; i++) {
        const state = voiceCoreState(step, 'speaking', 1);
        const p = reactorDiscPoint(i / 32 * Math.PI * 2, 107, -40, state.rotation, state.gazeYaw);
        const back = reactorDiscPoint(i / 32 * Math.PI * 2, 107, 40, state.rotation, state.gazeYaw);
        expect(Math.hypot(p.x - back.x, p.y - back.y, p.z - back.z)).toBeCloseTo(80);
        const q = projectReactor(p, state.pitch);
        expect(q.x).toBeGreaterThan(0); expect(q.x).toBeLessThan(VOICE_CORE_VIEW.width);
        expect(q.y).toBeGreaterThan(0); expect(q.y).toBeLessThan(VOICE_CORE_VIEW.height);
      }
    }
  });
  it('emits at most five deterministic arcs attached to the core and outer coils', () => {
    for (let step = 0; step < 80; step++) {
      const state = voiceCoreState(step * .37, 'speaking', 1), arcs = voiceTeslaSparks(state);
      expect(arcs).toHaveLength(5); expect(arcs).toEqual(voiceTeslaSparks(state));
      for (const arc of arcs) {
        const source = arc.points[0], target = arc.points[arc.points.length - 1];
        expect(Math.hypot(source.x, source.y, source.z)).toBeCloseTo(Math.hypot(state.coreRadius + 2, 52));
        expect(Math.hypot(target.x, target.y, target.z)).toBeCloseTo(Math.hypot(96, 52));
        for (const p of [...arc.points, ...arc.branch]) {
          expect(Math.hypot(p.x, p.y, p.z)).toBeLessThan(115);
        }
      }
    }
  });
  it.each(phases)('renders finite geometry in %s and restores the context', phase => {
    let saved = 0;
    const coordinates: number[][] = [];
    const record = (...args: number[]) => coordinates.push(args);
    const gradient = () => ({ addColorStop() {} });
    const ctx = { save() { saved++; }, restore() { saved--; }, beginPath() {}, closePath() {}, stroke() {}, fill() {}, clip() {},
      moveTo: record, lineTo: record, arc: record, ellipse: record, fillRect: record,
      createRadialGradient: gradient, createLinearGradient: gradient } as unknown as CanvasRenderingContext2D;
    drawJarvisVoiceField(ctx, { time: 13, phase, level: 1 });
    expect(saved).toBe(0);
    expect(coordinates.length).toBeGreaterThan(100);
    expect(coordinates.every(args => args.every(Number.isFinite))).toBe(true);
    expect(coordinates.every(([x, y]) => x >= 0 && x <= VOICE_CORE_VIEW.width && y >= 0 && y <= VOICE_CORE_VIEW.height)).toBe(true);
  });
});
