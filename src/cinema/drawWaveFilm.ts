import { DEFAULT_FONTS, filmText, signalColor, type FilmFonts } from './filmDrawing';
import { beginFilmViewport, fillFilmViewport, type FilmViewportInsets } from './filmViewport';
import { drawCornerField } from './components/drawCornerField';
import { drawEnvironmentFocus, drawEnvironmentZones } from './components/drawZoneEnvironment';
import { DEFAULT_ENVIRONMENT_DATA, ENVIRONMENT_FILM_SECONDS, ENVIRONMENT_TIMING,
  zoneEnvironmentState, type ZoneEnvironmentData, type ZoneEnvironmentState } from './zoneEnvironment';
import { isEnvironmentPortrait } from './environmentMobileLayout';
import { drawEnvironmentMobile } from './components/drawEnvironmentMobile';
import { pad2 } from './filmMath';

export const WAVE_FILM_SECONDS = ENVIRONMENT_FILM_SECONDS;

/**
 * Stable chapter ID. 이 함수가 2D 로 그리는 것은 구역 순회(2.5~21.5s)와 이력 차트(23~34s) 뿐이다.
 * ENVIRONMENT_TIMING.heatmapStart(35s) 부터 장면 끝까지는 SmtLineExplorer(3D, SignalFilm.tsx 가 마운트)
 * 가 화면을 완전히 덮으므로 배경만 채운다 — drawSignalFilm.ts 의 space3d 렌더러와 같은 이유다:
 * 미리보기(홈 화면 배경 루프)에서는 3D 오버레이가 마운트되지 않아 이 배경이 그대로 보이고,
 * 실사용 중에는 3D 오버레이가 완전히 덮으므로 이 fillRect 조차 보이지 않는다.
 *
 * 이 경계 이전까지 남기는 것은 ZONE 순회/차트 HUD(제목·눈금·구역카드·포커스 게이지)뿐이고,
 * 예전에 여기서 부르던 drawEnvironmentHeatmap(2D 히트맵)은 더 이상 부르지 않는다 — 3D 공간이
 * 그 자리를 대신한다. drawCornerField 는 다른 5개 장면과 공유하는 함수라 본체를 고치지 않고
 * 이 파일의 호출부에서만 35초 이후를 건너뛴다.
 */
export function drawWaveFilm(ctx: CanvasRenderingContext2D, width: number, height: number, time: number,
  fonts: FilmFonts = DEFAULT_FONTS, insets?: FilmViewportInsets, data: ZoneEnvironmentData = DEFAULT_ENVIRONMENT_DATA,
  frame?: ZoneEnvironmentState | null) {
  const state = frame ?? zoneEnvironmentState(time, data);
  if (isEnvironmentPortrait(width, height)) {
    drawEnvironmentMobile(ctx, width, height, fonts, state, data, data === DEFAULT_ENVIRONMENT_DATA, insets);
    return;
  }
  const view = beginFilmViewport(ctx, width, height, insets);
  if (state.elapsed >= ENVIRONMENT_TIMING.heatmapStart) {
    ctx.fillStyle = '#07101a'; // smtLine/smtLineModel.ts 의 scene.background 와 맞춘 톤.
    fillFilmViewport(ctx, view);
    return;
  }
  drawCornerField(ctx, view, state.elapsed, state.focus * .35);
  const text = (value: string, x: number, y: number, size: number, alpha = 1, mono = false, heat = 0) =>
    filmText(ctx, fonts, value, x, y, size, alpha * state.reveal, mono, 'left', signalColor(heat, 1));
  text('ENVIRONMENT / ZONE MONITOR', 72, 76, 14, .75, true);
  text(state.elapsed >= ENVIRONMENT_TIMING.chartsStart ? '구역별 24시간 온도 변화' : data.title, 72, 110, 20);
  text('공통 온도 눈금 · 점선은 관리 범위', 565, 110, 11, state.historyPhase * .6);
  text(`${pad2(state.zones.length)} ZONES`, 945, 112, 18, .85, true);
  const readings = state.zones.map(item => item.status);
  const normal = readings.filter(status => status === 'normal').length;
  const outside = readings.filter(status => status === 'outside').length;
  const missing = readings.filter(status => status === 'missing').length;
  text(`범위 내 ${normal}  /  이탈 ${outside}  /  미확인 ${missing}`, 945, 136, 11, .8, false, outside ? 1 : 0);
  drawEnvironmentZones(ctx, fonts, state);
  drawEnvironmentFocus(ctx, fonts, state);
  if (!state.zones.length && !state.selected && state.showIntro) {
    text('ZONE 데이터 대기 중', 433, 356, 32, .9);
  }
  text(data === DEFAULT_ENVIRONMENT_DATA ? '시연 데이터 · 온도 이력 / 관리 범위 예시' : '전달 데이터 · 최근 24시간', 945, 689, 11, .5);
}
