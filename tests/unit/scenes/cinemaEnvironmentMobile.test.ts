import { describe, expect, it } from 'vitest';
import { ENVIRONMENT_PORTRAIT, environmentMobileHistoryLayout, environmentMobileState, environmentViewportTransform,
  isEnvironmentPortrait } from '@/cinema/environmentMobileLayout';
import { filmViewportTransform } from '@/cinema/filmViewport';
import { DEFAULT_ENVIRONMENT_DATA, ENVIRONMENT_TIMING, zoneEnvironmentState } from '@/cinema/zoneEnvironment';
import { environmentCanvasPoint, environmentSceneObjects } from '@/cinema/environmentSceneObjects';
import { createEnvironmentSelection } from '@/cinema/environmentSelection';
import { waveFilmMode } from '@/cinema/drawWaveFilm';

describe('portrait environment composition', () => {
  it.each([[320, 640], [390, 844], [430, 932], [768, 1024]])('fills portrait %s x %s above the dock', (width, height) => {
    const view = environmentViewportTransform(width, height, { bottomInset: 64 });
    expect(isEnvironmentPortrait(width, height)).toBe(true);
    expect(view.offsetX).toBeGreaterThanOrEqual(0);
    expect(view.offsetY + ENVIRONMENT_PORTRAIT.height * view.scale).toBeLessThan(height - 64);
    if (width < 500) expect(view.scale).toBeGreaterThan(filmViewportTransform(width, height, { bottomInset: 64 }).scale * 2);
  });

  it('keeps the desktop and landscape transforms unchanged', () => {
    for (const [width, height] of [[1280, 805], [844, 390], [900, 700]]) {
      expect(isEnvironmentPortrait(width, height)).toBe(false);
      expect(environmentViewportTransform(width, height, { bottomInset: 208 }))
        .toEqual(filmViewportTransform(width, height, { bottomInset: 208 }));
    }
  });

  it.each([2, 8, 21.5, 22, 23, 28, 34.5, 90])('keeps ten nonoverlapping cards and source data at time %s', time => {
    const source = zoneEnvironmentState(time, DEFAULT_ENVIRONMENT_DATA, 'ZONE 08');
    const original = source.zones.map(item => ({ ...item.anchor }));
    const mobile = environmentMobileState(source);
    expect(new Set(mobile.zones.map(item => item.anchor.x)).size).toBe(2);
    expect(mobile.zones.map(item => item.zone)).toEqual(source.zones.map(item => item.zone));
    expect(source.zones.map(item => item.anchor)).toEqual(original);
    expect(mobile.elapsed).toBe(source.elapsed);
    expect(mobile.selected).toBe(mobile.zones.find(item => item.selected));
    const bounds = environmentSceneObjects(mobile).map(object => ({
      left: Math.min(...object.bounds.map(point => point.x)), right: Math.max(...object.bounds.map(point => point.x)),
      top: Math.min(...object.bounds.map(point => point.y)), bottom: Math.max(...object.bounds.map(point => point.y)),
    }));
    for (const [index, box] of bounds.entries()) {
      expect(box.left).toBeGreaterThan(0); expect(box.right).toBeLessThan(440);
      expect(box.top).toBeGreaterThan(90); expect(box.bottom).toBeLessThan(940);
      for (const other of bounds.slice(index + 1)) {
        expect(box.right < other.left || other.right < box.left || box.bottom < other.top || other.bottom < box.top).toBe(true);
      }
    }
    if (time >= 25) for (const item of mobile.zones) {
      const chart = environmentMobileHistoryLayout(item);
      expect(chart.top - 15).toBeGreaterThan(item.anchor.y + 60);
      expect(chart.top + chart.height + 17).toBeLessThan(1000);
      const next = mobile.zones[item.index + 2];
      if (next) expect(chart.top + chart.height + 17).toBeLessThan(next.anchor.y - 44);
    }
  });

  it.each([1, 2, 3])('uses the painted mobile coordinates for every card at DPR %s', dpr => {
    const session = createEnvironmentSelection();
    const zones = DEFAULT_ENVIRONMENT_DATA.zones.map((zone, i) => ({ ...zone, id: `SENSOR ${i}` }));
    for (const time of [8, 22, 28]) {
      const mobile = environmentMobileState(session.update(time, { ...DEFAULT_ENVIRONMENT_DATA, zones })!);
      const surface = { left: 7, top: 11, width: 390, height: 844,
        pixelWidth: 390 * dpr, pixelHeight: 844 * dpr, bottomInset: 64 * dpr };
      const view = environmentViewportTransform(surface.pixelWidth, surface.pixelHeight, { bottomInset: surface.bottomInset });
      for (const item of mobile.zones) {
        const point = environmentCanvasPoint(surface, { x: surface.left + (item.anchor.x * view.scale + view.offsetX) / dpr,
          y: surface.top + (item.anchor.y * view.scale + view.offsetY) / dpr });
        session.pick(point, true);
        expect(session.selectedId).toBe(item.zone.id);
      }
    }
    session.update(40); session.pick({ x: 110, y: 124 }, true);
    expect(session.selectedId).toBeNull();
    expect(environmentMobileState(zoneEnvironmentState(8, { title: '', zones: [] })).zones).toEqual([]);
  });

  // Round 6: 세로 화면에서도 35초부터는 3D(SmtLineExplorer)가 덮으므로, drawWaveFilm 이 옛 2D
  // 히트맵(drawEnvironmentMobile)으로 계속 빠지면 안 된다 — 버그였던 그 순서를 고정한다.
  it.each([[390, 844], [430, 932], [320, 640]])('세로 %sx%s 도 35초부터는 overlay3d 로 판정한다(2D 로 새지 않는다)', (width, height) => {
    expect(isEnvironmentPortrait(width, height)).toBe(true); // 전제 확인 — 이 크기는 실제로 세로다.
    expect(waveFilmMode(width, height, ENVIRONMENT_TIMING.heatmapStart - .1)).toBe('mobile');
    expect(waveFilmMode(width, height, ENVIRONMENT_TIMING.heatmapStart)).toBe('overlay3d');
    expect(waveFilmMode(width, height, ENVIRONMENT_TIMING.heatmapStart + .1)).toBe('overlay3d');
    // 90초(모니터링) 이후에도 — 여전히 3D 가 화면을 덮는다. 2D 로 되돌아가면 안 된다.
    expect(waveFilmMode(width, height, ENVIRONMENT_TIMING.monitoringStart)).toBe('overlay3d');
  });

  it('가로 화면은 기존과 같은 경계(35초)에서 desktop → overlay3d 로 바뀐다', () => {
    expect(isEnvironmentPortrait(1280, 800)).toBe(false);
    expect(waveFilmMode(1280, 800, ENVIRONMENT_TIMING.heatmapStart - .1)).toBe('desktop');
    expect(waveFilmMode(1280, 800, ENVIRONMENT_TIMING.heatmapStart)).toBe('overlay3d');
  });
});
