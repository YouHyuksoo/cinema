/**
 * Bound fill-rate cost without changing CSS layout, the film clock or picking.
 *
 * Two independent controls: the bitmap scale (`ratio`) and the painting cadence (`frameInterval`).
 * A slow machine cannot finish a heavy scene inside one animation frame, so painting every frame
 * leaves the main thread without an idle gap and pointer events wait behind the draw. Capping the
 * cadence restores that gap, which matters more for button latency than resolution does.
 */
const FRAME_CAPS = [0, 1000 / 30, 1000 / 20, 1000 / 15];

export interface FilmDeviceHints { cores?: number; memory?: number }

/** The coarse CPU/memory hints the browser exposes; both are optional and never precise. */
export function browserDeviceHints(): FilmDeviceHints {
  const agent = typeof navigator === 'undefined' ? undefined : navigator as Navigator & { deviceMemory?: number };
  return { cores: agent?.hardwareConcurrency, memory: agent?.deviceMemory };
}

/** Low-end machines start at 30fps instead of discovering the cost through a second of dropped input. */
export function isLowEndDevice({ cores, memory }: FilmDeviceHints) {
  return (typeof cores === 'number' && cores > 0 && cores <= 4)
    || (typeof memory === 'number' && memory > 0 && memory <= 4);
}

export interface FilmRenderBudgetOptions {
  /** True when the bitmap must never exceed 1x (explicit low mode or a device the hints mark slow). */
  lowDetail?: () => boolean;
}

/** Frames arriving this late while the draw itself is cheap mean something else owns the main thread. */
const LATE_FRAME_MS = 40;

export function createFilmRenderBudget(hints: FilmDeviceHints = browserDeviceHints(), options: FilmRenderBudgetOptions = {}) {
  let quality = 1, start = -1, count = 0, cost = 0, interval = 0, quietWindows = 0, floorWindows = 0;
  let cap = isLowEndDevice(hints) ? 1 : 0;
  let lateWindows = 0, calmWindows = 0, external = false;
  return {
    ratio(width: number, height: number, dpr: number) {
      const ceiling = options.lowDetail?.() ? 1 : 2;
      const native = Number.isFinite(dpr) && dpr > 0 ? Math.min(dpr, ceiling) : 1;
      return Math.min(native, Math.sqrt(3840 * 2160 / Math.max(1, width * height))) * quality;
    },
    /** Minimum milliseconds between painted frames; 0 paints on every animation frame. */
    get frameInterval() { return FRAME_CAPS[cap]; },
    /**
     * True while this machine is over budget: the cadence is capped, or frames keep arriving late
     * although the canvas is cheap (DOM animations, layout or the compositor are the cost then, so
     * the cadence stays and only the page decoration is asked to step down).
     */
    get pressured() { return cap > 0 || external; },
    /** Change at most once per second; recover only after four quiet windows. */
    sample(now: number, drawMs: number, frameMs: number) {
      if (![now, drawMs, frameMs].every(Number.isFinite) || drawMs < 0 || frameMs <= 0 || frameMs > 250) return false;
      if (start < 0) start = now;
      count++; cost += drawMs; interval += frameMs;
      if (now - start < 1000 || count < 12) return false;
      const meanCost = cost / count, meanInterval = interval / count;
      const previous = quality;
      // A capped cadence lengthens the interval on purpose, so judge it against the current target.
      const target = FRAME_CAPS[cap] || 1000 / 60;
      // Two late windows in a row raise external pressure; two calm windows in a row clear it.
      if (meanCost <= 6 && meanInterval > Math.max(target + 12, LATE_FRAME_MS)) { calmWindows = 0; if (++lateWindows >= 2) external = true; }
      else { lateWindows = 0; if (++calmWindows >= 2) external = false; }
      if (meanCost > 10 || (meanCost > 6 && meanInterval > target + 8)) {
        quietWindows = 0;
        // Frames far over budget give up smoothness first: idle gaps keep clicks and React commits fast.
        const wanted = meanCost > 40 ? 3 : meanCost > 22 ? 2 : meanCost > 12 ? 1 : cap;
        if (wanted > cap) cap = Math.min(FRAME_CAPS.length - 1, cap + 1);
        if (quality > .75) { quality = Math.max(.75, quality - .125); floorWindows = 0; }
        // Only a machine that stays over budget at the normal floor drops below it.
        else if (++floorWindows >= 4) { quality = Math.max(.5, quality - .125); floorWindows = 0; }
      } else if (meanCost < 4 && meanInterval < target + 4) {
        floorWindows = 0;
        if (++quietWindows >= 4) {
          quietWindows = 0;
          if (quality < 1) quality = Math.min(1, quality + .125);
          else if (cap > 0) cap--;
        }
      } else { quietWindows = 0; floorWindows = 0; }
      start = now; count = 0; cost = 0; interval = 0;
      return quality !== previous;
    },
  };
}
