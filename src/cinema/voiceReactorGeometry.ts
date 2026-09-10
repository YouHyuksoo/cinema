import { VOICE_CORE_VIEW, type VoiceCoreState } from './jarvisVoiceCore';
import { createLensProjection } from './filmLens';

export interface ReactorPoint { x: number; y: number; z: number }
const TAU = Math.PI * 2;

/** One pose's projector: the lens trig is computed once, then applied to any number of points. */
export function reactorProjector(pitch = .27) {
  const tilt = Number.isFinite(pitch) ? pitch : .27;
  const view = createLensProjection({ lens: 900, pitch: tilt, centerX: VOICE_CORE_VIEW.x, centerY: VOICE_CORE_VIEW.y });
  return (p: ReactorPoint): ReactorPoint => { const s = view(p.x, p.y, p.z); return { x: s.x, y: s.y, z: s.depth }; };
}
export function projectReactor(p: ReactorPoint, pitch = .27) {
  return reactorProjector(pitch)(p);
}

/** One pose's rotator: the rotation and yaw trig is computed once, then applied to any number of points. */
export function reactorRotator(rotation: number, yaw = -.36) {
  const cosR = Math.cos(rotation), sinR = Math.sin(rotation), cosY = Math.cos(yaw), sinY = Math.sin(yaw);
  return (p: ReactorPoint): ReactorPoint => {
    const x = p.x * cosR - p.y * sinR;
    const y = p.x * sinR + p.y * cosR;
    return { x: x * cosY + p.z * sinY, y, z: p.z * cosY - x * sinY };
  };
}
/** The entire solid reactor turns around its tilted axis, including attached sparks. */
export function rotateReactorPoint(p: ReactorPoint, rotation: number, yaw = -.36): ReactorPoint {
  return reactorRotator(rotation, yaw)(p);
}

export function reactorDiscPoint(angle: number, radius: number, depth: number, rotation = 0, yaw = -.36): ReactorPoint {
  return rotateReactorPoint({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, z: depth }, rotation, yaw);
}

export const REACTOR_HALF = 40;

export interface ReactorGlyph { kind: number; band: 'side' | 'front'; strokes: ReactorPoint[][] }

/** Engineer-like marks: stacked arcs, nested chevrons, forks. Avoid radial tick teeth. */
const GLYPH_MARKS: [number, number][][][] = [
  [[[-1, -.8], [.7, -.8]], [[-.65, -.15], [1, -.15]], [[-.95, .5], [.4, .5]], [[-.15, .5], [-.15, 1]]],
  [[[-1, .35], [0, -1], [1, .35]], [[-.55, .2], [0, -.4], [.55, .2]], [[-.25, .7], [.35, .7]]],
  [[[-.2, -1], [-.2, .15], [-1, .85]], [[-.2, .15], [.9, .8]], [[-.7, -.25], [.45, -.25]]],
  [[[-.15, -.2], [-.7, .15], [-.15, .55], [.45, .15], [-.15, -.2]], [[-1, -.85], [.2, -.85]], [[.15, .7], [.85, .7]]],
  [[[-1, -1], [.35, -1]], [[-.4, -.35], [1, -.35]], [[-.9, .3], [.55, .3]], [[.1, .3], [.1, 1], [-.5, 1]]],
  [[[-1, .9], [-.15, -.9], [.85, .9]], [[-.55, .35], [.15, -.2], [.7, .4]]],
  [[[-.9, -.7], [.8, -.7], [.15, .15]], [[-.7, .15], [.95, .15]], [[-.4, .7], [.5, .7]]],
  [[[.15, -1], [-.85, -.1], [.15, .7]], [[.15, -.15], [1, -.15]], [[-.35, .95], [.7, .95]]],
];

function mapSideGlyph(gx: number, gy: number, angle: number, yaw: number): ReactorPoint {
  const a = angle + gx * .14, z = gy * 32;
  return rotateReactorPoint({ x: Math.cos(a) * 106.5, y: Math.sin(a) * 106.5, z }, 0, yaw);
}

export function reactorRimGlyphs(state: VoiceCoreState): ReactorGlyph[] {
  const count = 10;
  return Array.from({ length: count }, (_, i) => {
    const kind = (i * 3 + 1) % GLYPH_MARKS.length;
    const angle = i / count * TAU + state.collar;
    return {
      kind, band: 'side' as const,
      strokes: GLYPH_MARKS[kind].map(stroke => stroke.map(([gx, gy]) => mapSideGlyph(gx, gy, angle, state.gazeYaw))),
    };
  });
}

const hash = (a: number, b: number) => {
  const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return v - Math.floor(v);
};
const mix = (a: ReactorPoint, b: ReactorPoint, t: number): ReactorPoint => ({ x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });

export interface VoiceTeslaSpark { points: ReactorPoint[]; branch: ReactorPoint[]; intensity: number }

/** Voice-driven discharges bridge the plasma core and outer coils, all on the front face. */
export function voiceTeslaSparks(state: VoiceCoreState): VoiceTeslaSpark[] {
  if (!state.sparkCount || state.reduced) return [];
  const beat = Math.floor(state.time * 7);
  return Array.from({ length: state.sparkCount }, (_, index) => {
    const seed = beat * 13 + index * 71, angle = hash(seed, 1) * TAU;
    const targetAngle = angle + (hash(seed, 2) - .5) * .5;
    const source = { x: Math.cos(angle) * (state.coreRadius + 2), y: Math.sin(angle) * (state.coreRadius + 2), z: -52 };
    const target = { x: Math.cos(targetAngle) * 96, y: Math.sin(targetAngle) * 96, z: -52 };
    const local = Array.from({ length: 10 }, (_, step) => {
      const t = step / 9, p = mix(source, target, t), jitter = Math.sin(Math.PI * t) * (4 + state.energy * 9);
      return { x: p.x + (hash(seed, step * 3 + 4) - .5) * jitter,
        y: p.y + (hash(seed, step * 3 + 5) - .5) * jitter, z: -52 };
    });
    const branchEnd = { x: Math.cos(targetAngle + .25) * 85, y: Math.sin(targetAngle + .25) * 85, z: -52 };
    const rotate = (p: ReactorPoint) => rotateReactorPoint(p, state.rotation, state.gazeYaw);
    return { points: local.map(rotate), branch: [local[5], mix(local[5], branchEnd, .45), branchEnd].map(rotate),
      intensity: .55 + state.energy * .35 + Math.sin(state.time * 9 + index) * .08 };
  });
}
