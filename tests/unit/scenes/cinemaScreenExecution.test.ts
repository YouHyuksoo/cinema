import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('react', () => ({ useRef: (current: unknown) => ({ current }), useEffect: (effect: () => void) => effect() }));
import { useScreenCommands } from '@/cinema/useScreenCommands';
import { createScreenObjectRegistry } from '@/cinema/screenObjectRegistry';
import type { FilmPlayback } from '@/cinema/useFilmPlayback';
import type { FilmCamera } from '@/cinema/useFilmCamera';

beforeEach(() => { vi.useFakeTimers(); vi.stubGlobal('window', { setTimeout }); vi.stubGlobal('document', { querySelector: vi.fn() }); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
function setup(apply = true) {
  const player = { ready: true, position: { chapter: { id: 'bars', duration: 30 }, localTime: 0 }, texture: { style: 'glass', intensity: .5 },
    charts: { bars: { dimension: '3d', depthScale: 1 }, pie: { dimension: '3d', depthScale: 1 } }, speed: 1,
    cctv: { manual: false, camera: null, step: vi.fn() },
    factory: { manual: false, selectedKey: null, zoom: vi.fn(), deselect: vi.fn() },
    environment: { selectedId: null, step: vi.fn(), clear: vi.fn() },
    selectChapter: vi.fn((id: string) => { if (apply) player.position.chapter.id = id; }), seek: vi.fn(),
    changeSpeed: vi.fn((value: number) => { if (apply) player.speed = value; }),
  };
  const camera = { status: 'off', start: vi.fn(async () => { throw new Error('permission denied'); }) };
  const registry = createScreenObjectRegistry();
  const context = { registry, player: player as unknown as FilmPlayback, camera: camera as unknown as FilmCamera,
    preview: true, menuOpen: false, settingsOpen: false, menu: vi.fn(), settings: vi.fn(), home: vi.fn(), stopAll:vi.fn() };
  return { execute: useScreenCommands(context), player, camera, registry };
}
describe('screen executor observed results', () => {
  it('confirms the observed value after applying the real setter', async () => {
    const { execute, player } = setup();
    const pending = execute({ action: 'set', key: 'speed', value: '1.5' });
    await vi.advanceTimersByTimeAsync(230);
    expect(await pending).toMatchObject({ ok: true, state: { speed: 1.5 } });
    expect(player.changeSpeed).toHaveBeenCalledExactlyOnceWith(1.5);
  });
  it('describes scene navigation as opening a screen instead of a production', async () => {
    const { execute } = setup();
    const pending = execute({ action: 'set', key: 'scene', value: 'spc' });
    await vi.advanceTimersByTimeAsync(230);
    expect(await pending).toMatchObject({ ok: true, message: 'SPC 분석 화면을 엽니다.' });
  });
  it('does not report success if the setter did not update the value', async () => {
    const { execute } = setup(false);
    const pending = execute({ action: 'set', key: 'speed', value: '1.5' });
    await vi.advanceTimersByTimeAsync(230);
    expect(await pending).toMatchObject({ ok: false, state: { speed: 1 } });
  });
  it('refuses out-of-range inputs without invoking setters', async () => {
    const { execute, player } = setup();
    expect(await execute({ action: 'set', key: 'speed', value: '900' })).toMatchObject({ ok: false });
    expect(player.changeSpeed).not.toHaveBeenCalled();
  });
  it('routes scene object commands to the same controllers used by pointer controls', async () => {
    const { execute, player } = setup();
    await execute({ action: 'set', key: 'cctvStep', value: 'next' });
    await execute({ action: 'set', key: 'factoryZoom', value: 'in' });
    await execute({ action: 'set', key: 'environmentClear', value: 'true' });
    expect(player.cctv.step).toHaveBeenCalledWith(1);
    expect(player.factory.zoom).toHaveBeenCalledWith(-120);
    expect(player.environment.clear).toHaveBeenCalledOnce();
  });
  it('publishes controller methods through the object registry', () => {
    const { registry } = setup();
    expect(registry.catalog().find(object => object.id === 'factory')?.methods.map(method => method.id))
      .toEqual(expect.arrayContaining(['select', 'focus', 'reset', 'zoom', 'deselect']));
  });
  it('calls the card object method without querying or clicking DOM nodes', async () => {
    const { execute, registry } = setup();
    const focusCard = vi.fn(() => ({ ok:true, message:'확대' }));
    registry.register({ id:'stream.right', description:'우측 카드', methods:{ focusCard:{ description:'카드 확대', parameters:{id:{type:'string'}}, execute:focusCard } } });
    expect(await execute({ action:'set', key:'focusCard', value:'right:production' })).toMatchObject({ ok:true });
    expect(focusCard).toHaveBeenCalledWith({ id:'production' });
    expect(document.querySelector).not.toHaveBeenCalled();
  });
});
