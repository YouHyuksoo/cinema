import { beforeEach, describe, expect, it, vi } from 'vitest';
import { drawSignalFilm } from '@/cinema/drawSignalFilm';
import { drawWaveFilm } from '@/cinema/drawWaveFilm';
import { drawVisorTourFilm } from '@/cinema/drawVisorTourFilm';
import { drawSmtExploreFilm } from '@/cinema/drawSmtExploreFilm';
import { chapterStart } from '@/cinema/filmProgram';
import { createFactoryInteraction } from '@/cinema/smtFactoryInteraction';
import { canvasFixture, type Fill } from '../support/canvasFixture';

/**
 * 무대(3D)가 켜져 있으면 공간 챕터(wave/visor)의 2D 배경 묘사는 건너뛰어야 한다.
 * 이 조건이 하나라도 빠지면 3D 무대 위에 불투명한 2D 배경이 겹쳐 그려져, 화면상으로는
 * 미묘하지만 무대가 통째로 가려진다. HUD 렌더러(drawEnvironmentZones 등)는 무대와 무관하게
 * 항상 그려져야 한다.
 */
const drawEnvironmentHeatmap = vi.fn();
const drawSmtFactory = vi.fn();
const drawEnvironmentZones = vi.fn();
const drawEnvironmentFocus = vi.fn();

vi.mock('@/cinema/components/drawEnvironmentHeatmap', () => ({
  drawEnvironmentHeatmap: (...args: unknown[]) => drawEnvironmentHeatmap(...args),
}));
vi.mock('@/cinema/components/drawSmtFactory', () => ({
  drawSmtFactory: (...args: unknown[]) => drawSmtFactory(...args),
}));
vi.mock('@/cinema/components/drawZoneEnvironment', () => ({
  drawEnvironmentZones: (...args: unknown[]) => drawEnvironmentZones(...args),
  drawEnvironmentFocus: (...args: unknown[]) => drawEnvironmentFocus(...args),
}));

const fonts = { label: 'Label', mono: 'Mono' };
const waveTime = chapterStart('wave') + 5;
const visorTime = chapterStart('visor') + 5;

beforeEach(() => {
  drawEnvironmentHeatmap.mockClear();
  drawSmtFactory.mockClear();
  drawEnvironmentZones.mockClear();
  drawEnvironmentFocus.mockClear();
});

describe('무대가 켜졌을 때 공간 챕터의 2D 배경 우회', () => {
  it('wave 챕터: stage=true 면 온도 히트맵(공간 묘사)을 건너뛴다', () => {
    const fixture = canvasFixture();
    drawSignalFilm(fixture.ctx, 1280, 720, waveTime, fonts, undefined, undefined, null, null, undefined, undefined, null, true);
    expect(drawEnvironmentHeatmap).not.toHaveBeenCalled();
  });

  it('wave 챕터: stage=false 면 온도 히트맵을 그린다', () => {
    const fixture = canvasFixture();
    drawSignalFilm(fixture.ctx, 1280, 720, waveTime, fonts, undefined, undefined, null, null, undefined, undefined, null, false);
    expect(drawEnvironmentHeatmap).toHaveBeenCalledTimes(1);
  });

  it('visor 챕터(자동 투어): stage=true 면 SMT 공장(공간 묘사)을 건너뛴다', () => {
    const fixture = canvasFixture();
    drawSignalFilm(fixture.ctx, 1280, 720, visorTime, fonts, undefined, undefined, null, null, undefined, undefined, null, true);
    expect(drawSmtFactory).not.toHaveBeenCalled();
  });

  it('visor 챕터(자동 투어): stage=false 면 SMT 공장을 그린다', () => {
    const fixture = canvasFixture();
    drawSignalFilm(fixture.ctx, 1280, 720, visorTime, fonts, undefined, undefined, null, null, undefined, undefined, null, false);
    expect(drawSmtFactory).toHaveBeenCalledTimes(1);
  });

  it('visor 챕터(수동 탐색): stage=true 면 SMT 공장(공간 묘사)을 건너뛴다', () => {
    const interaction = createFactoryInteraction(visorTime);
    const fixture = canvasFixture();
    drawSignalFilm(fixture.ctx, 1280, 720, visorTime, fonts, undefined, undefined, interaction, null, undefined, undefined, null, true);
    expect(drawSmtFactory).not.toHaveBeenCalled();
  });

  it('visor 챕터(수동 탐색): stage=false 면 SMT 공장을 그린다', () => {
    const interaction = createFactoryInteraction(visorTime);
    const fixture = canvasFixture();
    drawSignalFilm(fixture.ctx, 1280, 720, visorTime, fonts, undefined, undefined, interaction, null, undefined, undefined, null, false);
    expect(drawSmtFactory).toHaveBeenCalledTimes(1);
  });

  it('HUD 렌더러(drawEnvironmentZones/drawEnvironmentFocus)는 stage 값과 무관하게 항상 호출된다', () => {
    for (const stage of [true, false]) {
      drawEnvironmentZones.mockClear();
      drawEnvironmentFocus.mockClear();
      const fixture = canvasFixture();
      drawSignalFilm(fixture.ctx, 1280, 720, waveTime, fonts, undefined, undefined, null, null, undefined, undefined, null, stage);
      expect(drawEnvironmentZones).toHaveBeenCalledTimes(1);
      expect(drawEnvironmentFocus).toHaveBeenCalledTimes(1);
    }
  });

  it('stage 인자를 생략하면 기존 2D 배경이 그대로 나온다 (기본값 false)', () => {
    const waveFixture = canvasFixture();
    drawSignalFilm(waveFixture.ctx, 1280, 720, waveTime, fonts);
    expect(drawEnvironmentHeatmap).toHaveBeenCalledTimes(1);
    const visorFixture = canvasFixture();
    drawSignalFilm(visorFixture.ctx, 1280, 720, visorTime, fonts);
    expect(drawSmtFactory).toHaveBeenCalledTimes(1);
  });
});

/**
 * `drawSmtFactory`/`drawEnvironmentHeatmap` 호출 여부만으로는 충분하지 않다: 세 공간 챕터는 그 호출보다
 * 먼저 뷰포트 전체를 덮는 불투명 배경(코너필드 · 방사형 wash 그라디언트)을 그리고 있었고, 이 배경은
 * `drawSmtFactory`/`drawEnvironmentHeatmap` 자체와 무관하게 무대(3D)를 완전히 가린다. 아래 테스트는
 * 실제로 뷰포트 전체 크기의 fillRect 가 그려지는지를 `canvasFixture` 의 fill 기록으로 직접 검증한다.
 */
const isFullViewportFill = (fill: Fill) => fill.rect[2] >= 1280 && fill.rect[3] >= 700;

describe('무대가 켜졌을 때 공간 챕터의 불투명 배경(뷰포트 전체 fill) 우회', () => {
  it('wave 챕터: stage=true 면 코너필드의 불투명 배경도 그려지지 않는다', () => {
    const fixture = canvasFixture();
    drawWaveFilm(fixture.ctx, 1280, 720, 5, fonts, undefined, undefined, null, true);
    expect(fixture.fills.some(f => f.fillStyle === '#040b10')).toBe(false);
    expect(fixture.fills.some(isFullViewportFill)).toBe(false);
  });

  it('wave 챕터: stage=false 면 코너필드의 불투명 배경을 그린다', () => {
    const fixture = canvasFixture();
    drawWaveFilm(fixture.ctx, 1280, 720, 5, fonts, undefined, undefined, null, false);
    expect(fixture.fills.some(f => f.fillStyle === '#040b10')).toBe(true);
    expect(fixture.fills.some(isFullViewportFill)).toBe(true);
  });

  it('visor 챕터(자동 투어): stage=true 면 방사형 wash 배경이 그려지지 않는다', () => {
    const fixture = canvasFixture();
    drawVisorTourFilm(fixture.ctx, 1280, 720, 5, fonts, undefined, true);
    expect(fixture.fills.some(isFullViewportFill)).toBe(false);
  });

  it('visor 챕터(자동 투어): stage=false 면 방사형 wash 배경을 그린다', () => {
    const fixture = canvasFixture();
    drawVisorTourFilm(fixture.ctx, 1280, 720, 5, fonts, undefined, false);
    expect(fixture.fills.some(isFullViewportFill)).toBe(true);
  });

  it('visor 챕터(수동 탐색): stage=true 면 방사형 wash 배경이 그려지지 않는다', () => {
    const interaction = createFactoryInteraction(5);
    const fixture = canvasFixture();
    drawSmtExploreFilm(fixture.ctx, 1280, 720, 5, fonts, undefined, interaction, true);
    expect(fixture.fills.some(isFullViewportFill)).toBe(false);
  });

  it('visor 챕터(수동 탐색): stage=false 면 방사형 wash 배경을 그린다', () => {
    const interaction = createFactoryInteraction(5);
    const fixture = canvasFixture();
    drawSmtExploreFilm(fixture.ctx, 1280, 720, 5, fonts, undefined, interaction, false);
    expect(fixture.fills.some(isFullViewportFill)).toBe(true);
  });
});
