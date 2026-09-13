/** Bound fill-rate cost without changing CSS layout, the film clock or picking. */
export function createFilmRenderBudget() {
  let quality = 1, start = -1, count = 0, cost = 0, interval = 0, quietWindows = 0;
  return {
    ratio(width: number, height: number, dpr: number) {
      const native = Number.isFinite(dpr) && dpr > 0 ? Math.min(dpr, 2) : 1;
      return Math.min(native, Math.sqrt(3840 * 2160 / Math.max(1, width * height))) * quality;
    },
    /** Change at most once per second; recover only after four quiet windows. */
    sample(now: number, drawMs: number, frameMs: number) {
      if (![now, drawMs, frameMs].every(Number.isFinite) || drawMs < 0 || frameMs <= 0 || frameMs > 250) return false;
      if (start < 0) start = now;
      count++; cost += drawMs; interval += frameMs;
      if (now - start < 1000 || count < 12) return false;
      const meanCost = cost / count, meanInterval = interval / count;
      const previous = quality;
      if (meanCost > 10 || (meanCost > 6 && meanInterval > 25)) {
        quality = Math.max(.75, quality - .125); quietWindows = 0;
      } else if (meanCost < 4 && meanInterval < 19) {
        if (++quietWindows >= 4) { quality = Math.min(1, quality + .125); quietWindows = 0; }
      } else quietWindows = 0;
      start = now; count = 0; cost = 0; interval = 0;
      return quality !== previous;
    },
  };
}
