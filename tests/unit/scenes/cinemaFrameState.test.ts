import { describe, expect, it, vi } from 'vitest';
import { drawSignalFilm } from '@/cinema/drawSignalFilm';
import { drawTransparentMachineFilm } from '@/cinema/drawTransparentMachineFilm';
import { chapterStart, type FilmId } from '@/cinema/filmProgram';

// Only the DOM-backed raster surface is omitted; scene, background and frame code run unchanged.
vi.mock('@/cinema/components/drawProjectedFilmSurface', () => ({ drawProjectedFilmSurface: () => undefined }));

interface Paint {
  globalAlpha: number;
  globalCompositeOperation: string;
  filter: string;
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  lineDash: number[];
}
interface Fill extends Paint { fillStyle: unknown; rect: number[] }

/** Stateful Canvas fixture: paths are irrelevant here, but save/restore and paint are real. */
function canvasFixture(initial: Partial<Paint> = {}) {
  let state: Record<string, unknown> = {
    globalAlpha: 1, globalCompositeOperation: 'source-over', filter: 'none',
    shadowColor: 'rgba(0,0,0,0)', shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0,
    lineDash: [], fillStyle: '#000000', strokeStyle: '#000000', lineWidth: 1, ...initial,
  };
  const stack: Record<string, unknown>[] = [], fills: Fill[] = [];
  const paint = (): Paint => ({
    globalAlpha: state.globalAlpha as number,
    globalCompositeOperation: state.globalCompositeOperation as string,
    filter: state.filter as string, shadowColor: state.shadowColor as string,
    shadowBlur: state.shadowBlur as number, shadowOffsetX: state.shadowOffsetX as number,
    shadowOffsetY: state.shadowOffsetY as number, lineDash: [...state.lineDash as number[]],
  });
  const gradient = () => ({ addColorStop: () => undefined });
  const methods: Record<string, unknown> = {
    canvas: { width: 1280, height: 720 },
    save: () => stack.push({ ...state, lineDash: [...state.lineDash as number[]] }),
    restore: () => { state = stack.pop() ?? state; },
    fillRect: (...rect: number[]) => fills.push({ ...paint(), fillStyle: state.fillStyle, rect }),
    getLineDash: () => [...state.lineDash as number[]],
    setLineDash: (segments: number[]) => { state.lineDash = [...segments]; },
    createLinearGradient: gradient, createRadialGradient: gradient, createConicGradient: gradient,
    measureText: (text: string) => ({ width: text.length * 7 }),
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
  };
  const noop = () => undefined;
  const ctx = new Proxy({}, {
    get: (_target, key) => typeof key === 'string' ? methods[key] ?? state[key] ?? noop : undefined,
    set: (_target, key, value) => { state[String(key)] = value; return true; },
  }) as CanvasRenderingContext2D;
  return { ctx, fills, paint, stack };
}

function expectOpaqueBackground(fill: Fill) {
  expect(fill.globalAlpha).toBe(1);
  expect(fill.globalCompositeOperation).toBe('source-over');
  expect(fill.filter).toBe('none');
  expect(fill.shadowBlur).toBe(0);
  expect(fill.shadowOffsetX).toBe(0);
  expect(fill.shadowOffsetY).toBe(0);
  expect(fill.lineDash).toEqual([]);
}

describe('cinema frame paint isolation', () => {
  it.each([0, 35.5, 35.98, 36])('keeps machine annotation opacity inside its scope at %s seconds', time => {
    const fixture = canvasFixture({ globalAlpha: .37 });
    drawTransparentMachineFilm(fixture.ctx, 1280, 720, time);
    expect(fixture.ctx.globalAlpha).toBe(.37);
    expect(fixture.stack).toHaveLength(0);
  });

  it.each(['network', 'energy', 'product', 'spc'] as const)(
    'repaints an opaque %s background after the machine fade', chapter => {
      const fixture = canvasFixture();
      drawSignalFilm(fixture.ctx, 1280, 720, chapterStart('machine') + 35.98);
      fixture.fills.length = 0;
      drawSignalFilm(fixture.ctx, 1280, 720, chapterStart(chapter) + 8);
      expect(fixture.fills[0].fillStyle).toBe('#040b10');
      expectOpaqueBackground(fixture.fills[0]);
      expect(fixture.stack).toHaveLength(0);
    },
  );

  it('starts with neutral paint and restores the caller paint after a frame', () => {
    const fixture = canvasFixture({ globalAlpha: .3, globalCompositeOperation: 'lighter', filter: 'blur(8px)',
      shadowColor: '#ffffff', shadowBlur: 16, shadowOffsetX: 8, shadowOffsetY: -4, lineDash: [7, 3] });
    const before = fixture.paint();
    drawSignalFilm(fixture.ctx, 1280, 720, chapterStart('network') + 8);
    expectOpaqueBackground(fixture.fills[0]);
    expect(fixture.paint()).toEqual(before);
    expect(fixture.stack).toHaveLength(0);
  });

  it('repaints every frame when paused on the fade or seeking into another chapter', () => {
    const fixture = canvasFixture();
    const positions: [FilmId, number][] = [
      ['machine', 35.98], ['machine', 35.98], ['network', 8], ['machine', 0], ['energy', 12], ['network', 0],
    ];
    for (const [chapter, localTime] of positions) {
      fixture.fills.length = 0;
      drawSignalFilm(fixture.ctx, 1280, 720, chapterStart(chapter) + localTime);
      expectOpaqueBackground(fixture.fills[0]);
      expect(fixture.ctx.globalAlpha).toBe(1);
      expect(fixture.stack).toHaveLength(0);
    }
  });
});
