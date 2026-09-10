import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFrameLoop, fitCanvasToBox, watchPageVisibility, watchReducedMotion } from '@/cinema/filmMotion';

type Frame = (now: number) => void;
let queue: Map<number, Frame>;
let nextId: number;
const flush = (now: number) => { const pending = [...queue.values()]; queue.clear(); pending.forEach(callback => callback(now)); };
const listenerTarget = () => {
  const listeners = new Set<() => void>();
  return { listeners, addEventListener: (_: string, fn: () => void) => listeners.add(fn), removeEventListener: (_: string, fn: () => void) => listeners.delete(fn) };
};

beforeEach(() => {
  queue = new Map(); nextId = 1;
  vi.stubGlobal('requestAnimationFrame', (callback: Frame) => { const id = nextId++; queue.set(id, callback); return id; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => { queue.delete(id); });
});
afterEach(() => vi.unstubAllGlobals());

describe('createFrameLoop', () => {
  it('requests one frame per tick until stopped, and start is idempotent', () => {
    const ticks: number[] = [];
    const loop = createFrameLoop(now => ticks.push(now));
    loop.start(); loop.start();
    expect(queue.size).toBe(1);
    flush(16); flush(32);
    expect(ticks).toEqual([16, 32]);
    expect(loop.running).toBe(true);
    loop.stop();
    expect(queue.size).toBe(0);
    expect(loop.running).toBe(false);
    flush(48);
    expect(ticks).toEqual([16, 32]);
  });
  it('ends after the frame whose tick stops it, and can restart', () => {
    const loop = createFrameLoop(now => { if (now >= 2) loop.stop(); });
    loop.start(); flush(1);
    expect(queue.size).toBe(1);
    flush(2);
    expect(queue.size).toBe(0);
    expect(loop.running).toBe(false);
    loop.start();
    expect(queue.size).toBe(1);
  });
});

describe('watchReducedMotion', () => {
  it('reports the current preference, forwards changes and unsubscribes', () => {
    const media = { ...listenerTarget(), matches: false };
    vi.stubGlobal('window', { matchMedia: (query: string) => { expect(query).toBe('(prefers-reduced-motion: reduce)'); return media; } });
    const seen: boolean[] = [];
    const motion = watchReducedMotion(reduced => seen.push(reduced));
    expect(motion.reduced).toBe(false);
    media.matches = true; media.listeners.forEach(fn => fn());
    expect(motion.reduced).toBe(true);
    expect(seen).toEqual([true]);
    motion.stop();
    expect(media.listeners.size).toBe(0);
  });
  it('works without a listener', () => {
    const media = { ...listenerTarget(), matches: true };
    vi.stubGlobal('window', { matchMedia: () => media });
    const motion = watchReducedMotion();
    expect(motion.reduced).toBe(true);
    expect(media.listeners.size).toBe(0);
    motion.stop();
  });
});

describe('watchPageVisibility', () => {
  it('forwards document.hidden on each change and unsubscribes', () => {
    const doc = { ...listenerTarget(), hidden: false };
    vi.stubGlobal('document', doc);
    const seen: boolean[] = [];
    const stop = watchPageVisibility(hidden => seen.push(hidden));
    doc.hidden = true; doc.listeners.forEach(fn => fn());
    doc.hidden = false; doc.listeners.forEach(fn => fn());
    expect(seen).toEqual([true, false]);
    stop();
    expect(doc.listeners.size).toBe(0);
  });
});

describe('fitCanvasToBox', () => {
  it('rounds the bitmap at a capped ratio, resizes only on change and maps units to CSS pixels', () => {
    vi.stubGlobal('window', { devicePixelRatio: 3 });
    let writes = 0;
    const canvas = { w: 0, h: 0, get width() { return this.w; }, set width(v: number) { this.w = v; writes++; },
      get height() { return this.h; }, set height(v: number) { this.h = v; writes++; } } as unknown as HTMLCanvasElement;
    const transforms: number[][] = [];
    const ctx = { setTransform: (...args: number[]) => { transforms.push(args); } } as unknown as CanvasRenderingContext2D;
    expect(fitCanvasToBox(canvas, ctx, 100.4, 50.2)).toBe(2);
    expect([canvas.width, canvas.height]).toEqual([201, 100]);
    expect(writes).toBe(2);
    fitCanvasToBox(canvas, ctx, 100.4, 50.2);
    expect(writes).toBe(2);
    expect(transforms).toEqual([[2, 0, 0, 2, 0, 0], [2, 0, 0, 2, 0, 0]]);
    vi.stubGlobal('window', { devicePixelRatio: 0 });
    expect(fitCanvasToBox(canvas, ctx, 10, 10)).toBe(1);
  });
});
