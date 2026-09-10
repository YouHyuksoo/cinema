/**
 * Session gate and state machine for the airlock intro: closed doors with the cube on stage, then the
 * doors open once the cube has solved itself and the HUD behind them is ready. No DOM; the caller
 * supplies the clock, so the sequence is deterministic and testable.
 */
export const INTRO_SESSION_KEY = 'hatchery.intro.v1';
export const INTRO_TIMING = { holdMs: 800, doorMs: 1100, returnDelayMs: 400, cubeTimeoutMs: 9000 } as const;

export type IntroPhase = 'closed' | 'opening' | 'done';
/** What the cube view should do: stage itself, fly home, snap home, or nothing (intro over). */
export type IntroCubeCue = 'stage' | 'return' | 'snap' | null;
export interface IntroFrame { phase: IntroPhase; door: number; cube: IntroCubeCue; skipped: boolean }

/** Once per tab session; reduced motion never plays. The flag is written as the intro starts so a reload mid-intro does not replay. */
export function shouldPlayIntro(storage: Pick<Storage, 'getItem' | 'setItem'> | null, reducedMotion: boolean) {
  let seen = false;
  try { seen = storage?.getItem(INTRO_SESSION_KEY) === '1'; } catch { seen = false; }
  try { storage?.setItem(INTRO_SESSION_KEY, '1'); } catch { /* storage blocked: play once for this document */ }
  return !seen && !reducedMotion;
}

const easeInOut = (t: number) => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export function createIntroTimeline(start: number) {
  let solvedAt: number | null = null, readyAt: number | null = null, dockedAt: number | null = null, skippedAt: number | null = null;
  /** When the doors started (or start) opening; null while still waiting. */
  const openingAt = (now: number) => {
    if (skippedAt !== null) return skippedAt;
    if (solvedAt !== null && readyAt !== null) return Math.max(solvedAt, readyAt);
    // A cube or a readiness probe that never reports must not keep the screen covered.
    if (now - start >= INTRO_TIMING.cubeTimeoutMs) return start + INTRO_TIMING.cubeTimeoutMs;
    return null;
  };
  return {
    solved(now: number) { solvedAt ??= now; },
    ready(now: number) { readyAt ??= now; },
    docked(now: number) { dockedAt ??= now; },
    skip(now: number) { skippedAt ??= now; },
    at(now: number): IntroFrame {
      const skipped = skippedAt !== null;
      const opened = openingAt(now);
      if (opened === null || now < opened) return { phase: 'closed', door: 0, cube: 'stage', skipped };
      const door = easeInOut(Math.max(0, Math.min(1, (now - opened) / INTRO_TIMING.doorMs)));
      const timedOut = solvedAt === null && !skipped;
      const cubeHome = dockedAt !== null || timedOut;
      if (door >= 1 && cubeHome) return { phase: 'done', door: 1, cube: null, skipped };
      const cube: IntroCubeCue = cubeHome ? null : skipped ? 'snap' : now - opened >= INTRO_TIMING.returnDelayMs ? 'return' : 'stage';
      return { phase: 'opening', door, cube, skipped };
    },
  };
}
