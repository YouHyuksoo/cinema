/**
 * Frame-loop lifecycle helpers for imperative canvas/SVG effects. These are plain functions, not
 * hooks: an effect keeps its own closure state and decides itself whether a hidden tab pauses,
 * cancels or releases a device. See DESIGN.md "렌더링 구조".
 */
export interface FrameLoop { start(): void; stop(): void; readonly running: boolean }

/** Requests one frame per tick until `stop()`; calling `stop()` inside `tick` ends the loop after that frame. */
export function createFrameLoop(tick: (now: number) => void): FrameLoop {
  let frame = 0, active = false;
  const step = (now: number) => {
    frame = 0;
    tick(now);
    if (active && !frame) frame = requestAnimationFrame(step);
  };
  return {
    get running() { return active; },
    start() { if (active) return; active = true; frame = requestAnimationFrame(step); },
    stop() { active = false; if (frame) cancelAnimationFrame(frame); frame = 0; },
  };
}

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** Current `prefers-reduced-motion` state plus an optional change subscription. */
export function watchReducedMotion(listener?: (reduced: boolean) => void) {
  const media = window.matchMedia(REDUCED_MOTION_QUERY);
  const change = () => listener?.(media.matches);
  if (listener) media.addEventListener('change', change);
  return {
    get reduced() { return media.matches; },
    stop() { if (listener) media.removeEventListener('change', change); },
  };
}

/** Calls `listener(document.hidden)` on every visibility change; returns the unsubscribe. */
export function watchPageVisibility(listener: (hidden: boolean) => void) {
  const change = () => listener(document.hidden);
  document.addEventListener('visibilitychange', change);
  return () => document.removeEventListener('visibilitychange', change);
}

/** Sizes the bitmap to its CSS box at a capped device pixel ratio and maps drawing units to CSS pixels. */
export function fitCanvasToBox(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D,
  cssWidth: number, cssHeight: number, maxDpr = 2) {
  const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
  const width = Math.round(cssWidth * dpr), height = Math.round(cssHeight * dpr);
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return dpr;
}
