import type { JarvisPhase } from './jarvisAudio';

export const VOICE_CORE_VIEW = { width: 800, height: 460, x: 400, y: 230 } as const;
export const VOICE_CORE_COLORS = { cyan: '#6be5ff', ice: '#d9faff', pink: '#ff79c6', violet: '#b5a2ff' } as const;
const TAU = Math.PI * 2;
const clamp = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;

/** Attack/release follows elapsed time rather than display refresh rate. */
export function voiceCoreEnvelope(previous: number, target: number, seconds: number) {
  const from = clamp(previous), to = clamp(target);
  const elapsed = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  return from + (to - from) * (1 - Math.exp(-elapsed / (to > from ? .065 : .24)));
}

export function voiceCoreState(time: number, phase: JarvisPhase, level: number, reduced = false) {
  const t = reduced || !Number.isFinite(time) ? 0 : time;
  const audible = phase === 'listening' || phase === 'speaking';
  const energy = !reduced && audible ? clamp(level) : 0;
  const thinking = phase === 'thinking' || phase === 'requesting';
  const speaking = phase === 'speaking';
  return {
    time: t, phase, energy, reduced, audible,
    radius: (thinking ? 128 : 143) + Math.sin(t * 1.2) * 2 + energy * 13,
    amplitude: (speaking ? 9 : thinking ? 3 : 4) + energy * (speaking ? 37 : 27),
    speed: thinking ? .65 : speaking ? .3 : .13,
    glow: phase === 'error' ? .18 : .35 + energy * .4,
    highlight: phase === 'error' || speaking ? VOICE_CORE_COLORS.pink : thinking ? VOICE_CORE_COLORS.violet : VOICE_CORE_COLORS.cyan,
  };
}
export type VoiceCoreState = ReturnType<typeof voiceCoreState>;

/** Positive z is farther from the viewer; preserve depth for back/front passes. */
export function projectVoiceCore(x: number, y: number, z: number) {
  const scale = 950 / (950 + z);
  return { x: VOICE_CORE_VIEW.x + x * scale, y: VOICE_CORE_VIEW.y + y * scale, z };
}

export function voiceCoreOrbit(angle: number, radius: number, height: number, pitch: number, roll: number) {
  const x = Math.cos(angle) * radius, y = height * Math.cos(pitch) - Math.sin(angle) * radius * Math.sin(pitch);
  return { x: x * Math.cos(roll) - y * Math.sin(roll), y: x * Math.sin(roll) + y * Math.cos(roll),
    z: height * Math.sin(pitch) + Math.sin(angle) * radius * Math.cos(pitch) };
}

/** Wrap sample selection continuously so the closed ribbon has no seam. */
export function voiceCoreWave(angle: number, state: VoiceCoreState, samples: Uint8Array) {
  const u = ((angle / TAU) % 1 + 1) % 1;
  const raw = state.audible && !state.reduced && samples.length
    ? ((samples[Math.min(samples.length - 1, Math.floor(u * samples.length))] ?? 128) - 128) / 128 : 0;
  return Math.sin(angle * 5 + state.time * 1.5) * state.amplitude * .5
    + Math.sin(angle * 9 - state.time * 1.1) * state.amplitude * .24 + raw * state.energy * 20;
}
