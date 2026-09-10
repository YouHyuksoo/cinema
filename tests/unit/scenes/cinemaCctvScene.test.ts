import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  CCTV_CAMERAS, CCTV_CONSOLE, CCTV_FILM_SECONDS, CCTV_INTRO_SECONDS, CCTV_PANEL_STEP, CCTV_PATROL_END, CCTV_PATROL_SECONDS, CCTV_WALL_START, cctvCameraAngle, cctvCentred,
  cctvGridCorners, cctvPanelPoses, cctvPick, cctvTimestamp, cctvTourAt, createCctvInteraction, selectCctv, settleCctv, stepCctv, turnCctv,
} from '@/cinema/cctvScene';
import { drawCctvFilm } from '@/cinema/drawCctvFilm';
import { CctvExplorer } from '@/cinema/CctvExplorer';
import { FILM_CHAPTERS, chapterStart } from '@/cinema/filmProgram';
import { resolveJarvisCommand } from '@/cinema/jarvisCommands';
import { recordingCanvas } from '../support/recordingCanvas';

const fonts = { label: 'Label', mono: 'Mono' };

describe('CCTV surveillance scene', () => {
  it('registers as the seventeenth chapter with nine distinct cameras', () => {
    expect(FILM_CHAPTERS.at(-1)).toMatchObject({ id: 'cctv', duration: CCTV_FILM_SECONDS });
    expect(chapterStart('cctv')).toBe(538);
    expect(CCTV_CAMERAS).toHaveLength(9);
    expect(new Set(CCTV_CAMERAS.map(camera => camera.kind)).size).toBe(9);
    expect(new Set(CCTV_CAMERAS.map(camera => camera.id)).size).toBe(9);
  });
  it('patrols every camera in order: sweep in, then travel, approach, hold and retreat per slot', () => {
    expect(cctvTourAt(0).focus).toBe(0);
    expect(cctvTourAt(CCTV_INTRO_SECONDS).turn).toBeCloseTo(cctvCameraAngle(0));
    const slot = CCTV_PATROL_SECONDS / 9;
    const visited: number[] = [];
    for (let t = CCTV_INTRO_SECONDS; t < CCTV_PATROL_END; t += .25) {
      const tour = cctvTourAt(t);
      if (visited.at(-1) !== tour.camera) visited.push(tour.camera);
      if (tour.focus > .95) expect(Math.abs(tour.turn - cctvCameraAngle(tour.camera))).toBeLessThan(1e-6);
    }
    expect(visited).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    const mid = cctvTourAt(CCTV_INTRO_SECONDS + slot * 3 + slot * .68);
    expect(mid.camera).toBe(3); expect(mid.focus).toBeCloseTo(1);
    expect(cctvTourAt(CCTV_INTRO_SECONDS + slot * 3 + slot * .1).focus).toBe(0);
    expect(cctvTourAt(CCTV_FILM_SECONDS).outro).toBe(0);
  });
  it('ends on a fixed console: the wall folds into a 3×3 grid after the patrol and holds until the fade', () => {
    expect(cctvTourAt(CCTV_PATROL_END - .1).wall).toBe(0);
    expect(cctvTourAt(CCTV_PATROL_END).wall).toBe(0);
    expect(cctvTourAt(CCTV_WALL_START).wall).toBe(1);
    expect(cctvTourAt(CCTV_WALL_START + 8).wall).toBe(1);
    expect(cctvTourAt(CCTV_WALL_START + 8).turn).toBeCloseTo(cctvCameraAngle(4));
    expect(CCTV_WALL_START).toBeLessThan(CCTV_FILM_SECONDS - 10);
    const cells = Array.from({ length: 9 }, (_, i) => cctvGridCorners(i));
    for (const cell of cells) {
      expect(cell[0].x).toBeGreaterThanOrEqual(CCTV_CONSOLE.grid.x); expect(cell[1].x).toBeLessThanOrEqual(CCTV_CONSOLE.grid.x + CCTV_CONSOLE.grid.width + 1);
      expect(cell[0].y).toBeGreaterThanOrEqual(CCTV_CONSOLE.grid.y); expect(cell[3].y).toBeLessThanOrEqual(CCTV_CONSOLE.grid.y + CCTV_CONSOLE.grid.height + 1);
      expect((cell[1].x - cell[0].x) / (cell[3].y - cell[0].y)).toBeCloseTo(330 / 186, 2);
    }
    expect(cells[0][0].y).toBe(cells[2][0].y); expect(cells[3][0].y).toBeGreaterThan(cells[0][3].y);
    expect(cells[4][0].x).toBeGreaterThan(cells[3][1].x);
    expect(cctvGridCorners(Number.NaN)).toEqual(cells[0]);
    const canvas = recordingCanvas();
    drawCctvFilm(canvas.ctx, 1280, 720, CCTV_WALL_START + 4, fonts);
    const texts = canvas.calls.filter(call => call[0] === 'fillText').map(call => String(call[1]));
    for (const label of ['CAMERA SEARCH', 'MONITORING', 'EVENTS', '다중 화면 감시 · 9 CAM LIVE · 고정 모니터링']) expect(texts).toContain(label);
    expect(texts.filter(text => text === 'REC').length).toBeGreaterThanOrEqual(9);
    // Monochrome feeds: one saturation-blend fill per cell rather than a per-call filter.
    expect(canvas.calls.filter(call => call[0] === 'set' && call[1] === 'globalCompositeOperation' && call[2] === 'saturation').length).toBe(9);
  });
  it('places the wall so about five panels are visible and the centred one comes forward', () => {
    const poses = cctvPanelPoses(cctvCameraAngle(4), index => index === 4 ? 1 : 0);
    const visible = poses.filter(pose => pose.visible && pose.center.x > -200 && pose.center.x < 1480);
    expect(visible.length).toBeGreaterThanOrEqual(5);
    expect(visible.length).toBeLessThanOrEqual(7);
    const centre = poses[4], side = poses[3];
    expect(Math.abs(centre.center.x - 640)).toBeLessThan(1);
    expect(centre.scale).toBeGreaterThan(side.scale);
    expect(centre.depth).toBeLessThan(cctvPanelPoses(cctvCameraAngle(4), () => 0)[4].depth);
    // Neighbours mirror around the centre.
    expect(poses[3].center.x + poses[5].center.x).toBeCloseTo(1280, 0);
  });
  it('centres the nearest camera, settles releases onto it and steps in order', () => {
    expect(cctvCentred(cctvCameraAngle(2)).camera).toBe(2);
    expect(cctvCentred(cctvCameraAngle(2)).amount).toBeCloseTo(1);
    expect(cctvCentred(cctvCameraAngle(2) + CCTV_PANEL_STEP / 2).amount).toBe(0);
    const manual = createCctvInteraction(CCTV_INTRO_SECONDS + 1);
    expect(manual.selected).toBeNull();
    const turned = turnCctv(manual, 60);
    expect(turned.turn).toBeLessThan(manual.turn);
    expect(settleCctv(turned).turn).toBeCloseTo(cctvCameraAngle(cctvCentred(turned.turn).camera));
    expect(stepCctv(selectCctv(manual, 4), 1).selected).toBe(5);
    expect(stepCctv(selectCctv(manual, 8), 1).selected).toBe(8);
    expect(selectCctv(manual, Number.NaN).selected).toBe(0);
    expect(turnCctv(manual, Number.NaN)).toEqual({ turn: manual.turn, selected: null });
    expect(Math.abs(turnCctv(manual, -1e9).turn)).toBeLessThan(Math.PI);
  });
  it('picks the camera under a screen point and nothing off the wall', () => {
    const turn = cctvCameraAngle(4);
    const poses = cctvPanelPoses(turn, () => 0);
    expect(cctvPick(poses[4].center, turn, () => 0)).toBe(4);
    expect(cctvPick(poses[3].center, turn, () => 0)).toBe(3);
    expect(cctvPick({ x: 640, y: 40 }, turn, () => 0)).toBeNull();
  });
  it('draws the room, rails, every visible feed and the REC/timestamp overlay deterministically', () => {
    const a = recordingCanvas(), b = recordingCanvas();
    drawCctvFilm(a.ctx, 1280, 720, 20, fonts);
    drawCctvFilm(b.ctx, 1280, 720, 20, fonts);
    expect(a.fingerprint()).toBe(b.fingerprint());
    const texts = a.calls.filter(call => call[0] === 'fillText').map(call => String(call[1]));
    expect(texts.some(text => text.startsWith('CCTV / 감시'))).toBe(true);
    expect(texts.filter(text => text === 'REC').length).toBeGreaterThanOrEqual(4);
    expect(texts.some(text => text === cctvTimestamp(20))).toBe(true);
    expect(cctvTimestamp(0)).toBe('2026-09-10 10:42:00');
    expect(cctvTimestamp(61.4)).toBe('2026-09-10 10:43:01');
    // Manual mode: heading and selection come from the explorer, the clock from `live`.
    const manual = recordingCanvas();
    drawCctvFilm(manual.ctx, 1280, 720, 5, fonts, undefined, { turn: cctvCameraAngle(7), selected: 7, live: 100 });
    const manualTexts = manual.calls.filter(call => call[0] === 'fillText').map(call => String(call[1]));
    expect(manualTexts.some(text => text.startsWith('CAM 08 · LOBBY-01'))).toBe(true);
    // Surveillance analytics: tracked people and vehicles carry class ids on the feeds.
    expect(texts.some(text => /^PERSON \S+ \d+%$/.test(text))).toBe(true);
    expect(texts.some(text => /^VEHICLE \d+ \d+%$/.test(text))).toBe(true);
    expect(manualTexts.some(text => text === cctvTimestamp(100))).toBe(true);
  });
  it('renders the explorer surface and a camera toolbar without bitmap assets', () => {
    const controller = { manual: false, camera: null, count: 9, readState: () => null, begin: vi.fn(), clear: vi.fn(), turn: vi.fn(), settle: vi.fn(), select: vi.fn(), step: vi.fn() };
    const html = renderToStaticMarkup(createElement(CctvExplorer, { canvas: { current: null }, controller, onAuto: vi.fn() }));
    expect(html).toContain('aria-label="CCTV 카메라 벽 탐색 영역"');
    expect(html).toContain('data-cctv-toolbar="true"');
    expect(html).toContain('자동 순찰 중'); expect(html).toContain('>직접 감시</button>');
    expect(html.match(/<option /g)).toHaveLength(10);
    expect(html).not.toMatch(/<img|<video|\.png|\.mp4/);
  });
  it('opens from voice commands about CCTV or surveillance', () => {
    expect(resolveJarvisCommand('CCTV 보여줘')).toMatchObject({ chapter: 'cctv' });
    expect(resolveJarvisCommand('감시 카메라 열어줘')).toMatchObject({ chapter: 'cctv' });
    expect(resolveJarvisCommand('온습도 보여줘')).toMatchObject({ chapter: 'wave' });
  });
});
