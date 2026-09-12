import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('react', () => ({ useRef: (current: unknown) => ({ current }) }));
import { useScreenCommands } from '@/cinema/useScreenCommands';
import type { FilmPlayback } from '@/cinema/useFilmPlayback';
import type { FilmCamera } from '@/cinema/useFilmCamera';

beforeEach(() => { vi.useFakeTimers(); vi.stubGlobal('window', { setTimeout }); vi.stubGlobal('document', { querySelector: () => null }); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
function setup(apply = true) {
  const player = { ready: true, position: { chapter: { id: 'bars', duration: 30 }, localTime: 0 }, texture: { style: 'glass', intensity: .5 },
    charts: { bars: { dimension: '3d', depthScale: 1 }, pie: { dimension: '3d', depthScale: 1 } }, speed: 1,
    changeSpeed: vi.fn((value: number) => { if (apply) player.speed = value; }),
  };
  const camera = { status: 'off', start: vi.fn(async () => { throw new Error('permission denied'); }) };
  const context = { player: player as unknown as FilmPlayback, camera: camera as unknown as FilmCamera,
    preview: true, menuOpen: false, settingsOpen: false, menu: vi.fn(), settings: vi.fn(), home: vi.fn() };
  return { execute: useScreenCommands(context), player, camera };
}
describe('screen executor observed results', () => {
  it('confirms the observed value after applying the real setter', async () => {
    const { execute, player } = setup();
    const pending = execute({ action: 'set', key: 'speed', value: '1.5' });
    await vi.advanceTimersByTimeAsync(230);
    expect(await pending).toMatchObject({ ok: true, state: { speed: 1.5 } });
    expect(player.changeSpeed).toHaveBeenCalledExactlyOnceWith(1.5);
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
});
