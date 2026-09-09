import type { JarvisPhase } from './jarvisAudio';

export const VOICE_CORE_VIEW = { width: 440, height: 320, x: 220, y: 134 } as const;
/** Cap in CSS pixels so a tall stage does not blow the reactor up to fill START–camera. */
export const VOICE_CORE_SCALE_MAX = .82;

export function voiceCoreCanvasTransform(cssWidth: number, cssHeight: number, dpr = 1) {
  const width = Number.isFinite(cssWidth) ? Math.max(1, cssWidth) : 1;
  const height = Number.isFinite(cssHeight) ? Math.max(1, cssHeight) : 1;
  const pixel = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
  const cssScale = Math.min(width / VOICE_CORE_VIEW.width, height / VOICE_CORE_VIEW.height, VOICE_CORE_SCALE_MAX);
  const scale = cssScale * pixel;
  return { scale, x: width * pixel / 2 - VOICE_CORE_VIEW.x * scale, y: height * pixel / 2 - VOICE_CORE_VIEW.y * scale };
}
export const VOICE_CORE_COLORS = { cyan: '#6be5ff', ice: '#d9faff', pink: '#ff79c6', violet: '#b5a2ff' } as const;
const clamp = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;

/** Attack/release follows elapsed time rather than display refresh rate. */
export function voiceCoreEnvelope(previous: number, target: number, seconds: number) {
  const from = clamp(previous), to = clamp(target);
  const elapsed = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  return from + (to - from) * (1 - Math.exp(-elapsed / (to > from ? .065 : .24)));
}

const BLINK_PERIOD = 4.4;
const BLINK_DURATION = .4;

/** 0 open → 1 shut. Brief lid close every few seconds, with an occasional double blink. */
export function voiceCoreBlink(time: number) {
  if (!Number.isFinite(time) || time < 0) return 0;
  const cycle = Math.floor(time / BLINK_PERIOD);
  const local = time - cycle * BLINK_PERIOD;
  const lid = (start: number) => {
    const u = local - start;
    if (u <= 0 || u >= BLINK_DURATION) return 0;
    const t = u / BLINK_DURATION;
    if (t < .32) return Math.sin(t / .32 * Math.PI / 2);
    if (t < .52) return 1;
    return Math.cos((t - .52) / .48 * Math.PI / 2);
  };
  return Math.max(lid(2.15), cycle % 3 === 2 ? lid(2.62) : 0);
}

/** Gaze pitch in radians: positive looks down, negative looks slightly up. Frozen at the original tilt when reduced. */
export function voiceCorePitch(time: number, reduced = false) {
  if (reduced || !Number.isFinite(time)) return .27;
  return .06 + Math.sin(time * .65) * .38 + Math.sin(time * .21) * .1;
}

/** Audio drives plasma and discharges; the reactor body retains its dimensions. */
export function voiceCoreState(time: number, phase: JarvisPhase, level: number, reduced = false) {
  const t = reduced || !Number.isFinite(time) ? 0 : time;
  const audible = phase === 'listening' || phase === 'speaking';
  const energy = !reduced && audible ? clamp(level) : 0;
  const thinking = phase === 'thinking' || phase === 'requesting';
  return {
    time: t, phase, energy, reduced,
    rotation: .38 + t * .16,
    coreRadius: 39 + energy * 8,
    glow: phase === 'error' ? .15 : .5 + energy * .45,
    sparkCount: energy > .045 ? Math.min(5, Math.ceil(energy * 5)) : 0,
    highlight: phase === 'error' ? VOICE_CORE_COLORS.pink : thinking ? VOICE_CORE_COLORS.violet : VOICE_CORE_COLORS.cyan,
    pitch: voiceCorePitch(t, reduced),
    blink: reduced ? 0 : voiceCoreBlink(t),
    gazeYaw: reduced ? -.36 : -.2 + Math.sin(t * .19) * .16,
    collar: reduced ? .2 : -t * .58,
  };
}
export type VoiceCoreState = ReturnType<typeof voiceCoreState> & { irisColor?: string };
