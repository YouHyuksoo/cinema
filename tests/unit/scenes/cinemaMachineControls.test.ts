import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { chapterStart, FILM_CHAPTERS, FILM_SECONDS } from '@/cinema/filmProgram';
import { FilmMachineControls } from '@/cinema/FilmMachineControls';
import { useFilmPlayback } from '@/cinema/useFilmPlayback';
import { resolveJarvisCommand } from '@/cinema/jarvisCommands';
import { drawSignalFilm } from '@/cinema/drawSignalFilm';
import { DEFAULT_FILM_SCENE_DATA } from '@/cinema/filmSceneData';
import { canvasFixture } from '../support/canvasFixture';

const hooks = vi.hoisted(() => ({ refs: [] as { current: unknown }[] }));
vi.mock('react', async importOriginal => ({
  ...await importOriginal<typeof import('react')>(),
  useState: <T>(value: T | (() => T)) => [typeof value === 'function' ? (value as () => T)() : value, vi.fn()],
  useRef: <T>(value: T) => { const ref = { current: value }; hooks.refs.push(ref); return ref; },
  useEffect: vi.fn(),
  useSyncExternalStore: (_subscribe: unknown, getSnapshot: () => unknown) => getSnapshot(),
}));
vi.mock('@/cinema/useSmtFactoryInteraction', () => ({ useSmtFactoryInteraction: () => ({ clear: vi.fn(), readState: () => null }) }));
vi.mock('@/cinema/useCctvInteraction', () => ({ useCctvInteraction: () => ({ clear: vi.fn(), readState: () => null, manual: false }) }));
vi.mock('@/cinema/useEnvironmentSelection', () => ({ useEnvironmentSelection: () => ({ clear: vi.fn(), update: () => null }) }));
beforeEach(() => { hooks.refs = []; });

describe('manual machine subject selection', () => {
  it('starts with PCB, rewinds only machine and preserves pause and other playback settings', () => {
    const player = useFilmPlayback({ current: null }, { current: {} } as never, { current: false });
    const clock = hooks.refs[0].current as { time: number; paused: boolean; machineSubject: string; speed: number; mode: string };
    expect(player.machineSubject).toBe('pcb');
    expect(clock.machineSubject).toBe('pcb');
    player.selectChapter('machine'); player.seek(15); player.togglePlay(); player.changeSpeed(2); player.changeMode('chapter');
    player.changeMachineSubject('car');
    expect(clock).toMatchObject({ time: chapterStart('machine'), paused: true, machineSubject: 'car', speed: 2, mode: 'chapter' });
    player.selectChapter('wave'); player.seek(9);
    expect(clock.machineSubject).toBe('car');
    player.changeMachineSubject('pcb');
    expect(clock.time).toBe(9);
    player.changeMachineSubject('bad' as never);
    expect(clock.machineSubject).toBe('pcb');
    expect(FILM_CHAPTERS).toHaveLength(17); expect(FILM_SECONDS).toBe(594);
  });
  it('exposes an explicit selector without automatic car switching', () => {
    const html = renderToStaticMarkup(createElement(FilmMachineControls, { subject: 'pcb', disabled: false, onChange: vi.fn() }));
    expect(html).toContain('분석 대상'); expect(html).toContain('PCB 불량 분석'); expect(html).toContain('자동차');
    expect(html).toContain('value="pcb" selected');
  });
  it('routes explicit PCB and car requests to their corresponding subject', () => {
    expect(resolveJarvisCommand('PCB 불량 보여줘')).toMatchObject({ chapter: 'machine', machineSubject: 'pcb' });
    expect(resolveJarvisCommand('자동차 보여줘')).toMatchObject({ chapter: 'machine', machineSubject: 'car' });
    expect(resolveJarvisCommand('레이싱카 열어줘')?.reply).toContain('자동차');
    expect(resolveJarvisCommand('자동차 말고 PCB 보여줘')).toMatchObject({ chapter: 'machine', machineSubject: 'pcb' });
    expect(resolveJarvisCommand('PCB 대신 자동차 보여줘')).toMatchObject({ chapter: 'machine', machineSubject: 'car' });
    expect(resolveJarvisCommand('PCB와 자동차 보여줘')?.chapter).toBeUndefined();
    expect(resolveJarvisCommand('자동차 보여주지 마')?.chapter).toBeUndefined();
    expect(resolveJarvisCommand('분해 보여줘')).toMatchObject({ chapter: 'machine', machineSubject: 'pcb' });
  });
  it('passes injected PCB and provenance through the dispatcher and keeps explicit car separate', () => {
    const data = { ...DEFAULT_FILM_SCENE_DATA, pcb: { ...DEFAULT_FILM_SCENE_DATA.pcb, name: 'CUSTOM PCB', components: [] } };
    const pcb = canvasFixture();
    drawSignalFilm(pcb.ctx, 1280, 720, chapterStart('machine') + 10, undefined, undefined, undefined, null, null, data,
      { subject: 'pcb', provenance: { source: 'static', at: '2026-09-08T12:00:00Z' } });
    expect(pcb.texts.map(t => t.value).join(' ')).toContain('CUSTOM PCB');
    expect(pcb.texts.map(t => t.value)).toContain('검사 대상 없음');
    expect(pcb.texts.map(t => t.value).join(' ')).toContain('STATIC');
    const car = canvasFixture();
    drawSignalFilm(car.ctx, 1280, 720, chapterStart('machine') + 10, undefined, undefined, undefined, null, null, data, { subject: 'car' });
    expect(car.texts.map(t => t.value)).toContain('AERO / X-RAY');
  });
});
