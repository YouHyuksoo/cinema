import type { VoiceCoreState } from './jarvisVoiceCore';
import { projectReactor, reactorDiscPoint, type ReactorPoint } from './voiceReactorGeometry';
import { reactorShipPosition, REACTOR_EGG_TIMING as timing, REACTOR_EGG_TARGET, REACTOR_PERCH } from './reactorShipFlight';

export { reactorShipPosition, REACTOR_EGG_TIMING, REACTOR_EGG_TARGET } from './reactorShipFlight';
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t); };
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

const gesture = (t: number, from: number, to: number, amplitude: number) => {
  const u = clamp((t - from) / (to - from));
  return Math.sin(u * Math.PI) * Math.sin(u * Math.PI * 5) * amplitude;
};

export function reactorEasterEggFrame(elapsed: number, reduced = false) {
  const duration = reduced ? 1.2 : timing.end;
  if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed >= duration) return null;
  const t = reduced ? 1 : elapsed, position = reactorShipPosition(t);
  const next = projectReactor(reactorShipPosition(Math.min(t + .025, timing.fire)), 0), now = projectReactor(position, 0);
  const perched = !reduced && t >= timing.perch && t < timing.shakeOff;
  const perchWeight = reduced ? 0 : smooth((t - 5.45) / .55) * (1 - smooth((t - timing.shakeOff) / .35));
  const freeHeading = Math.atan2(next.y - now.y, next.x - now.x);
  const heading = mix(freeHeading, Math.sin((t - timing.perch) * 8) * .13, perchWeight);
  const recovery = 1 - smooth((t - timing.recover) / (timing.end - timing.recover));
  const aim = reduced ? 0 : smooth((t - timing.turn) / (timing.aimed - timing.turn)) * recovery;
  const firing = !reduced && t >= timing.fire && t < timing.impact + .2;
  const impact = !reduced && t >= timing.impact && t < timing.impact + 1.18;
  const phase = reduced ? 'salute' : t < timing.arrived ? 'arrive' : t < timing.shoo ? 'tease'
    : t < timing.retreat ? 'shoo' : t < timing.firstReturn ? 'retreat' : t < timing.perch ? 'return-ship'
    : t < timing.shakeOff ? 'perch' : t < timing.secondRetreat ? 'shake-off' : t < timing.thirdReturn ? 'retreat-again'
    : t < timing.taunt ? 'return-again' : t < timing.rage ? 'taunt' : t < timing.flee ? 'rage'
    : t < timing.turn ? 'flee' : t < timing.fire ? 'aim' : t < timing.impact ? 'fire' : t < timing.recover ? 'impact' : 'return';
  return {
    time: t, reduced, phase, position, heading, perched, perchWeight,
    bank: reduced ? 0 : perched ? Math.sin((t - timing.perch) * 10) * .16 : Math.sin(t * 5) * .35,
    shake: reduced ? 0 : gesture(t, timing.shoo, timing.retreat, .55) + gesture(t, timing.shakeOff, timing.secondRetreat, .85),
    anger: reduced ? 0 : smooth((t - timing.rage) / 1.05) * recovery,
    shipVisible: reduced || t < timing.impact,
    behind: position.z > 0, aim, firing,
    laserReach: firing ? clamp((t - timing.fire) / (timing.impact - timing.fire)) : 0,
    laserAlpha: firing ? 1 - smooth((t - timing.impact - .05) / .15) : 0,
    impactAge: impact ? t - timing.impact : null,
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
  return { ...base, gazeYaw: mix(base.gazeYaw + egg.shake, yaw, egg.aim), pitch: mix(base.pitch + egg.shake * .2, pitch, egg.aim),
    blink: Math.max(base.blink * (1 - egg.aim), egg.firing ? 0 : egg.anger * .64),
    irisColor: egg.anger > 0 ? eyeColor : base.irisColor, irisHeat: egg.anger,
    sparkCount: egg.aim > .1 ? 0 : base.sparkCount };
}

/** A perched ship shares the nodding/shaking top of the reactor, not a fixed screen position. */
export function reactorPerchedShip(state: VoiceCoreState, egg: ReactorEasterEggFrame): ReactorEasterEggFrame {
  if (!egg.perchWeight) return egg;
  const bob = egg.perched ? Math.sin((egg.time - timing.perch) * 8) ** 2 * 3
    * (1 - smooth((egg.time - timing.shakeOff + .2) / .2)) : 0;
  const y = REACTOR_PERCH.y - bob, z = REACTOR_PERCH.z;
  const target = { x: z * Math.sin(state.gazeYaw),
    y: y * Math.cos(state.pitch) - z * Math.cos(state.gazeYaw) * Math.sin(state.pitch),
    z: y * Math.sin(state.pitch) + z * Math.cos(state.gazeYaw) * Math.cos(state.pitch) };
  const position = { x: mix(egg.position.x, target.x, egg.perchWeight),
    y: mix(egg.position.y, target.y, egg.perchWeight), z: mix(egg.position.z, target.z, egg.perchWeight) };
  return { ...egg, position, behind: position.z > 0 };
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
