import type { VoiceCoreState } from './jarvisVoiceCore';
import { projectReactor, reactorDiscPoint, type ReactorPoint } from './voiceReactorGeometry';

export const REACTOR_EGG_TIMING = { hide: 3.85, turn: 4.05, aimed: 4.48, fire: 5.25, impact: 5.47, recover: 6.35, end: 7.4 } as const;
export const REACTOR_EGG_TARGET: ReactorPoint = { x: 500, y: 150, z: 1550 };
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t); };
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

interface FlightSegment { end: number; points: [ReactorPoint, ReactorPoint, ReactorPoint, ReactorPoint] }
const p = (x: number, y: number, z: number): ReactorPoint => ({ x, y, z });
const FLIGHT: FlightSegment[] = [
  { end: 1, points: [p(-260, -55, -60), p(-180, -70, -100), p(-120, -10, -150), p(-62, -12, -160)] },
  { end: 1.65, points: [p(-62, -12, -160), p(15, -50, -170), p(70, -80, -160), p(75, -10, -160)] },
  { end: 2.4, points: [p(75, -10, -160), p(145, 50, -165), p(-25, 70, -160), p(-65, 20, -150)] },
  { end: 3.1, points: [p(-65, 20, -150), p(-125, -65, -150), p(50, -80, -130), p(102, -40, -125)] },
  { end: 3.85, points: [p(102, -40, -125), p(142, -40, -80), p(70, -20, 100), p(25, -15, 180)] },
  { end: 5.25, points: [p(25, -15, 180), p(55, 10, 360), p(410, 90, 1100), REACTOR_EGG_TARGET] },
];

/** Continuous world-space flight; positive z passes behind the opaque reactor. */
export function reactorShipPosition(time: number): ReactorPoint {
  let start = 0;
  for (const segment of FLIGHT) {
    if (time <= segment.end) {
      const t = clamp((time - start) / (segment.end - start)), v = 1 - t;
      const [a, b, c, d] = segment.points;
      const coordinate = (key: keyof ReactorPoint) => v ** 3 * a[key] + 3 * v * v * t * b[key] + 3 * v * t * t * c[key] + t ** 3 * d[key];
      return { x: coordinate('x'), y: coordinate('y'), z: coordinate('z') };
    }
    start = segment.end;
  }
  return { ...REACTOR_EGG_TARGET };
}

export function reactorEasterEggFrame(elapsed: number, reduced = false) {
  const duration = reduced ? 1.2 : REACTOR_EGG_TIMING.end;
  if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed >= duration) return null;
  const t = reduced ? 1 : elapsed, position = reactorShipPosition(t);
  const next = projectReactor(reactorShipPosition(Math.min(t + .025, 5.24)), 0), now = projectReactor(position, 0);
  const heading = t < 5.24 ? Math.atan2(next.y - now.y, next.x - now.x) : -.3;
  const aim = reduced ? 0 : smooth((t - REACTOR_EGG_TIMING.turn) / (REACTOR_EGG_TIMING.aimed - REACTOR_EGG_TIMING.turn))
    * (1 - smooth((t - REACTOR_EGG_TIMING.recover) / (REACTOR_EGG_TIMING.end - REACTOR_EGG_TIMING.recover)));
  const firing = !reduced && t >= REACTOR_EGG_TIMING.fire && t < 5.67;
  const impact = !reduced && t >= REACTOR_EGG_TIMING.impact && t < 6.65;
  const phase = reduced ? 'salute' : t < 1 ? 'arrive' : t < 3.1 ? 'tease' : t < 4.05 ? 'hide'
    : t < 5.25 ? 'aim' : t < 5.47 ? 'fire' : t < 6.35 ? 'impact' : 'return';
  return {
    time: t, reduced, phase, position, heading, bank: reduced ? 0 : Math.sin(t * 5) * .35,
    anger: reduced ? 0 : smooth((t - .9) / .45) * (1 - smooth((t - 6.35) / 1.05)),
    shipVisible: reduced || t < REACTOR_EGG_TIMING.impact,
    behind: position.z > 0, aim, firing,
    laserReach: firing ? clamp((t - REACTOR_EGG_TIMING.fire) / (REACTOR_EGG_TIMING.impact - REACTOR_EGG_TIMING.fire)) : 0,
    laserAlpha: firing ? 1 - smooth((t - 5.52) / .15) : 0,
    impactAge: impact ? t - REACTOR_EGG_TIMING.impact : null,
  };
}
export type ReactorEasterEggFrame = NonNullable<ReturnType<typeof reactorEasterEggFrame>>;

/** Front normal points exactly toward the distant ship at full aim. */
export function reactorEasterEggPose(base: VoiceCoreState, egg: ReactorEasterEggFrame | null): VoiceCoreState {
  if (!egg || egg.reduced) return base;
  const target = REACTOR_EGG_TARGET;
  const yaw = Math.atan2(-target.x, -Math.hypot(target.y, target.z));
  const pitch = Math.atan2(-target.y, target.z);
  const eyeColor = '#' + [1, 3, 5].map(index => Math.round(mix(parseInt(base.highlight.slice(index, index + 2), 16),
    parseInt('#ff304b'.slice(index, index + 2), 16), egg.anger)).toString(16).padStart(2, '0')).join('');
  return { ...base, gazeYaw: mix(base.gazeYaw, yaw, egg.aim), pitch: mix(base.pitch, pitch, egg.aim),
    blink: Math.max(base.blink * (1 - egg.aim), egg.firing ? 0 : egg.anger * .64),
    irisColor: egg.anger > 0 ? eyeColor : base.irisColor, sparkCount: egg.aim > .1 ? 0 : base.sparkCount };
}

/** Camera-space emitter point shares the reactor's actual yaw and pitch. */
export function reactorLaserOrigin(state: VoiceCoreState): ReactorPoint {
  const q = reactorDiscPoint(0, 0, -50, 0, state.gazeYaw);
  return { x: q.x, y: q.y * Math.cos(state.pitch) - q.z * Math.sin(state.pitch),
    z: q.y * Math.sin(state.pitch) + q.z * Math.cos(state.pitch) };
}

/** No timers or device side effects; one click owns one bounded animation. */
export function createReactorEggPlayback() {
  let elapsed: number | null = null, reduced = false;
  return {
    get active() { return elapsed !== null; },
    start(reduceMotion = false) {
      if (elapsed !== null) return false;
      elapsed = 0; reduced = reduceMotion; return true;
    },
    advance(seconds: number, reduceMotion = reduced) {
      if (elapsed === null) return null;
      if (reduceMotion && !reduced) { elapsed = null; return null; }
      elapsed += Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
      const frame = reactorEasterEggFrame(elapsed, reduced);
      if (!frame) elapsed = null;
      return frame;
    },
    cancel() { elapsed = null; },
  };
}
