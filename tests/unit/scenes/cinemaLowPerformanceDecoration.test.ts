import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFilmRenderBudget } from '@/cinema/filmRenderBudget';
import { createFilmShadowGate } from '@/cinema/filmShadowGate';
import { createFilmTextureRenderer } from '@/cinema/filmTexture';
import { PRESSURE_HOLD_MS, applyPerformanceMode, isLowPerformance, reportRenderPressure, resetPerformanceState, resolvedPerformance } from '@/cinema/filmPerformanceMode';
import { recordingCanvas } from '../support/recordingCanvas';

const css = (name: string) => readFileSync(`src/cinema/${name}.module.css`, 'utf8');
const LOW = ':global(html[data-film-perf=low])';

/**
 * Low mode is the one switch a slow machine (or a user) has against continuous decoration. Every
 * main-screen loop that repaints a filtered or shadowed element must answer to it, on the canvas
 * as well as in CSS, and the film loop must be able to raise it from what it measures.
 */
describe('low-performance decoration set', () => {
  it('stops the main-screen CSS loops that repaint filters, blurs or box-shadows every frame', () => {
    expect(css('jarvisMetricCards')).toContain(`${LOW} .card { animation:none; }`);
    expect(css('jarvisMetricCards')).toContain(`${LOW} :is(.flow,.conveyor,.warningHalo,.qualityScan,.powerOrbit,.powerFlow) { animation:none; }`);
    expect(css('jarvisMetricCards')).toContain(`${LOW} :is(.card svg,.card .frame,.bayFrame) { filter:none; }`);
    expect(css('jarvisStream')).toContain(`${LOW} .content>section { transform:none; }`);
    expect(css('jarvisStream')).toContain(`${LOW} .viewport { mask-image:none; }`);
    expect(css('jarvisStream')).toContain(`${LOW} :is(.orbit,.counterOrbit,.miniOrbit) { animation:none; }`);
    expect(css('jarvisStream')).toContain(`${LOW} :is(.spark,.holoGauge,.queueFlow,.inspectionScan,.miniDial svg) { filter:none; }`);
    expect(css('jarvisSignalScanner')).toContain(`${LOW} .scanner :is(.wallLights,.groove,.core) { filter:none; }`);
    expect(css('jarvis')).toContain(`${LOW} .input input { animation:none; border-color:var(--film-accent); }`);
    expect(css('filmMenuGlobe')).toContain(`${LOW} .layer[data-phase=closed] .ball { animation:none; }`);
    expect(css('filmMenuCube')).toContain(`${LOW} :is(.hit,.float) { animation:none; }`);
    expect(css('cyanPanelBackdrop')).toContain(`${LOW} .sweep { animation:none; }`);
    expect(css('jarvisCardFocus')).toContain(`${LOW} :is(.panel,.spaceDepth) { animation:none; }`);
    expect(css('jarvisCardFocus')).toContain(`${LOW} .spaceDepth::after { filter:none; }`);
    expect(css('filmTurbineMenu')).toContain(`${LOW} .menu[data-turbine-open=false] .rotor`);
  });
  it('drops every backdrop-filter, which blurs the whole layer stack beneath a panel', () => {
    for (const [name, selector] of [['film', '.dockSettings'], ['smtInteraction', '.toolbar'], ['screenObjectInspector', '.backdrop']]) {
      expect(css(name)).toMatch(new RegExp(`${LOW.replace(/[()[\]]/g, '\\$&')} ${selector.replace('.', '\\.')}\\s*\\{\\s*backdrop-filter:\\s*none;?\\s*\\}`));
    }
  });
  it('moves the stream scan line with background-position instead of laying out `top` on every frame', () => {
    const stream = css('jarvisStream');
    expect(stream).not.toMatch(/@keyframes panelScan \{ from \{ top:/);
    expect(stream).toContain('@keyframes panelScan { from { background-position:0 calc(0% + 6px),0 0; } to { background-position:0 calc(100% - 5px),0 100%; } }');
    expect(stream).toMatch(/\.content>section::after \{[^}]*top:4%; bottom:4%;[^}]*animation:panelScan 9s linear infinite;/);
  });
  it('stills the scanner pedestal from the component, because SMIL spins cannot be stopped by CSS', () => {
    const source = readFileSync('src/cinema/JarvisSignalScanner.tsx', 'utf8');
    expect(source).toContain('const still = reduced || useLowPerformance();');
    expect(source).toContain('data-still={still}');
  });
  it('quarters the idle reactor cadence and rasters it at 1x on a slow machine', () => {
    const source = readFileSync('src/cinema/JarvisWave.tsx', 'utf8');
    expect(source).toContain("now - lastIdleDraw < (isLowPerformance() ? 66 : 33)");
    expect(source).toContain('prefersLowDetail() ? 1 : 2');
    expect(source).toContain('performancePreference.subscribe(resize)');
  });
  it('re-poses the stream panels at a third of the cadence', () => {
    expect(readFileSync('src/cinema/JarvisStream.tsx', 'utf8')).toContain("(isLowPerformance() ? 100 : 32)");
  });
});

describe('film shadow gate', () => {
  class FakeContext {
    private blur = 0;
    get shadowBlur() { return this.blur; }
    set shadowBlur(value: number) { this.blur = value; }
    /** The value the native rasteriser would use. */
    get nativeBlur() { return this.blur; }
  }
  it('passes shadowBlur through while open and forces 0 while closed, keeping the renderer\'s value readable', () => {
    const ctx = new FakeContext(), gate = createFilmShadowGate(ctx as unknown as CanvasRenderingContext2D);
    ctx.shadowBlur = 12;
    expect(ctx.nativeBlur).toBe(12);
    gate.closed = true;
    expect(ctx.nativeBlur).toBe(0);
    expect(ctx.shadowBlur).toBe(12);
    ctx.shadowBlur = 8;
    expect(ctx.nativeBlur).toBe(0);
    expect(ctx.shadowBlur).toBe(8);
    gate.closed = false;
    expect(ctx.nativeBlur).toBe(8);
  });
  it('returns the same gate for the same context, so a re-run effect (Strict Mode, remount) keeps control of the accessor', () => {
    const ctx = new FakeContext(), first = createFilmShadowGate(ctx as unknown as CanvasRenderingContext2D);
    const second = createFilmShadowGate(ctx as unknown as CanvasRenderingContext2D);
    expect(second).toBe(first);
    ctx.shadowBlur = 7; second.closed = true;
    expect(ctx.nativeBlur).toBe(0);
  });
  it('leaves a context without a native accessor alone', () => {
    const recorder = recordingCanvas();
    const gate = createFilmShadowGate(recorder.ctx);
    gate.closed = true;
    recorder.ctx.shadowBlur = 5;
    expect(recorder.ctx.shadowBlur).toBe(5);
  });
});

describe('film render budget under low mode', () => {
  const fastDevice = { cores: 16, memory: 16 };
  it('never rasters above 1x while low detail is preferred', () => {
    let low = true;
    const budget = createFilmRenderBudget(fastDevice, { lowDetail: () => low });
    expect(budget.ratio(960, 540, 2)).toBe(1);
    low = false;
    expect(budget.ratio(960, 540, 2)).toBe(2);
  });
  it('reports pressure when frames arrive late although the canvas is cheap, without capping the cadence', () => {
    const budget = createFilmRenderBudget(fastDevice);
    for (let t = 0; t <= 1100; t += 45) budget.sample(t, 2, 45);
    expect(budget.pressured).toBe(false);
    for (let t = 1145; t <= 2300; t += 45) budget.sample(t, 2, 45);
    expect(budget.pressured).toBe(true);
    expect(budget.frameInterval).toBe(0);
    expect(budget.ratio(1920, 1080, 1)).toBe(1);
    for (let t = 2316; t <= 4600; t += 16) budget.sample(t, 2, 16);
    expect(budget.pressured).toBe(false);
  });
  it('ignores a 30 Hz display whose frames are simply spaced further apart', () => {
    const budget = createFilmRenderBudget(fastDevice);
    for (let t = 0; t <= 5000; t += 33) budget.sample(t, 2, 33);
    expect(budget.pressured).toBe(false);
  });
});

describe('sticky render pressure', () => {
  beforeEach(() => {
    resetPerformanceState();
    vi.stubGlobal('document', { documentElement: { setAttribute: vi.fn(), getAttribute: () => null } });
    vi.stubGlobal('navigator', { hardwareConcurrency: 16, deviceMemory: 16 });
  });
  afterEach(() => { vi.unstubAllGlobals(); resetPerformanceState(); });
  it('holds low mode after the last over-budget report so relief does not flip the decoration back at once', () => {
    applyPerformanceMode({ getItem: () => null });
    expect(isLowPerformance()).toBe(false);
    reportRenderPressure(true, 1000);
    expect(isLowPerformance()).toBe(true);
    reportRenderPressure(false, 1000 + PRESSURE_HOLD_MS / 2);
    expect(isLowPerformance()).toBe(true);
    reportRenderPressure(false, 1000 + PRESSURE_HOLD_MS + 1);
    expect(isLowPerformance()).toBe(false);
  });
  it('publishes the resolved mode to subscribers', () => {
    const listener = vi.fn();
    const stop = resolvedPerformance.subscribe(listener);
    applyPerformanceMode({ getItem: () => null });
    reportRenderPressure(true, 5000);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(resolvedPerformance.getSnapshot()).toBe('low');
    stop();
  });
});

describe('cheap texture pass', () => {
  let surfaces: ReturnType<typeof recordingCanvas>[];
  beforeEach(() => {
    surfaces = [];
    vi.stubGlobal('document', { createElement: () => {
      const recorder = recordingCanvas(); surfaces.push(recorder);
      const pixels = { getImageData: () => ({ data: new Uint8ClampedArray(4) }),
        createImageData: (width: number, height: number) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) }) };
      const ctx = new Proxy(recorder.ctx, { get: (target, key) => key in pixels ? pixels[key as keyof typeof pixels] : Reflect.get(target, key) });
      return { width: 0, height: 0, getContext: () => ctx };
    } });
  });
  afterEach(() => vi.unstubAllGlobals());
  it('skips the bloom and the grain pattern but keeps the material layers', () => {
    const settings = { style: 'glass' as const, intensity: .55 };
    const full = recordingCanvas();
    createFilmTextureRenderer('cyan')(full.ctx, 1280, 720, 3, settings, { now: 100 });
    surfaces = [];
    const cheap = recordingCanvas();
    createFilmTextureRenderer('cyan')(cheap.ctx, 1280, 720, 3, settings, { now: 100, cheap: true });
    const draws = (recorder: ReturnType<typeof recordingCanvas>) => recorder.calls.filter(call => call[0] === 'drawImage').length;
    const patternFills = (recorder: ReturnType<typeof recordingCanvas>) => recorder.calls.filter(call => call[0] === 'set' && call[1] === 'globalCompositeOperation' && call[2] === 'screen').length;
    expect(draws(cheap)).toBe(draws(full) - 1);
    expect(patternFills(cheap)).toBe(0);
    expect(surfaces.some(surface => surface.calls.some(call => call[0] === 'set' && call[1] === 'filter' && call[2] === 'blur(3px)'))).toBe(false);
  });
});
