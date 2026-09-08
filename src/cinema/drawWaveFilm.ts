import { DEFAULT_FONTS, filmText, signalColor, type FilmFonts } from './filmDrawing';
import { beginFilmViewport, type FilmViewportInsets } from './filmViewport';
import { drawCornerField } from './components/drawCornerField';
import { drawEnvironmentFocus, drawEnvironmentZones } from './components/drawZoneEnvironment';
import { DEFAULT_ENVIRONMENT_DATA, ENVIRONMENT_FILM_SECONDS, ENVIRONMENT_TIMING,
  environmentReadingStatus, zoneEnvironmentState, type ZoneEnvironmentData } from './zoneEnvironment';
import { drawEnvironmentHeatmap } from './components/drawEnvironmentHeatmap';

export const WAVE_FILM_SECONDS = ENVIRONMENT_FILM_SECONDS;

/** Stable chapter ID; the scene now tours manufacturing temperature and humidity stations. */
export function drawWaveFilm(ctx: CanvasRenderingContext2D, width: number, height: number, time: number,
  fonts: FilmFonts = DEFAULT_FONTS, insets?: FilmViewportInsets, data: ZoneEnvironmentData = DEFAULT_ENVIRONMENT_DATA) {
  const state = zoneEnvironmentState(time, data);
  const view = beginFilmViewport(ctx, width, height, insets);
  drawCornerField(ctx, view, state.elapsed, state.focus * .35);
  const text = (value: string, x: number, y: number, size: number, alpha = 1, mono = false, heat = 0) =>
    filmText(ctx, fonts, value, x, y, size, alpha * state.reveal, mono, 'left', signalColor(heat, 1));
  text('ENVIRONMENT / ZONE MONITOR', 72, 76, 14, .75, true);
  const map = state.heatmapReveal;
  const isMap = state.elapsed >= ENVIRONMENT_TIMING.heatmapStart;
  text(isMap ? '센서 설치 공간 / 온도 히트맵'
    : state.elapsed >= ENVIRONMENT_TIMING.chartsStart ? '구역별 24시간 온도 변화' : data.title, 72, 110, 20);
  text('공통 온도 눈금 · 점선은 관리 범위', 565, 110, 11, state.historyPhase * (1 - map) * .6);
  text(`${String(state.zones.length).padStart(2, '0')} ZONES`, 945, 112, 18, .85, true);
  const readings = isMap ? state.zones.map(item => environmentReadingStatus(item.zone.temperature, item.zone.temperatureRange))
    : state.zones.map(item => item.status);
  const normal = readings.filter(status => status === 'normal').length;
  const outside = readings.filter(status => status === 'outside').length;
  const missing = readings.filter(status => status === 'missing').length;
  text(`${isMap ? '온도 ' : ''}범위 내 ${normal}  /  이탈 ${outside}  /  미확인 ${missing}`, 945, 136, 11, .8, false, outside ? 1 : 0);
  drawEnvironmentZones(ctx, fonts, state);
  drawEnvironmentFocus(ctx, fonts, state);
  drawEnvironmentHeatmap(ctx, fonts, state);
  if (!state.selected && state.showIntro && map < .001) {
    text(state.zones.length ? '현장의 공기를 읽다' : 'ZONE 데이터 대기 중', 433, 356, 32, .9);
    text('온도와 습도 · 구역별 환경 상태', 433, 394, 15, .6);
    text('TEMPERATURE  /  RELATIVE HUMIDITY', 433, 428, 11, .4, true);
  }
  text(map > .5 ? 'SENSOR SPACE / 온도 분포'
    : state.historyPhase > .5 ? 'ZONE 01—05 / TOP     ·     ZONE 06—10 / BOTTOM'
    : state.selected ? `ZONE TOUR / ${String(state.selected.index + 1).padStart(2, '0')} OF ${state.zones.length}`
      : 'ALL ZONES / 전체 환경', 72, 689, 10, .55, true);
  text(map > .5 ? '센서값 보간 · 설치 공간은 예시 배치'
    : data === DEFAULT_ENVIRONMENT_DATA ? '시연 데이터 · 온도 이력 / 관리 범위 예시' : '전달 데이터 · 최근 24시간', 945, 689, 11, .5);
}
