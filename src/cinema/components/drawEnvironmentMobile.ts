import { filmText, signalColor, type FilmFonts } from '../filmDrawing';
import { ENVIRONMENT_TIMING, type ZoneEnvironmentData, type ZoneEnvironmentState } from '../zoneEnvironment';
import { environmentMobileHistoryLayout, environmentMobileState, environmentViewportTransform } from '../environmentMobileLayout';
import type { FilmViewportInsets } from '../filmViewport';
import { environmentGaugeState } from '../environmentGauge';
import { drawEnvironmentGauge } from './drawEnvironmentGauge';
import { drawEnvironmentLink } from './drawEnvironmentLink';
import { drawEnvironmentZones } from './drawZoneEnvironment';

function drawMobileFocus(ctx: CanvasRenderingContext2D, fonts: FilmFonts, state: ZoneEnvironmentState) {
  if (!state.selected) return;
  const { zone, anchor, index } = state.selected;
  const motion = environmentGaugeState(state), alpha = state.reveal * motion.opacity;
  if (alpha <= .001) return;
  // Scale the complete instruments, including their fixed-size labels and readouts.
  for (const humidity of [false, true]) {
    ctx.save(); ctx.translate(humidity ? 330 : 110, 184); ctx.scale(.65, .65);
    drawEnvironmentGauge(ctx, fonts, { x: 0, y: 0, radius: 132 }, humidity ? zone.humidity : zone.temperature,
      humidity ? zone.humidityRange : zone.temperatureRange, humidity, motion, alpha);
    ctx.restore();
  }
  filmText(ctx, fonts, `${zone.id} · ${zone.name}`, 220, 295, 15, alpha * motion.readingOpacity, false, 'center');
  // Route outside the cards so lower rows never draw a tether through other readings.
  const sideX = index % 2 ? 428 : 12, exitX = anchor.x + (index % 2 ? 84 : -84) * anchor.scale;
  drawEnvironmentLink(ctx, [{ x: exitX, y: anchor.y }, { x: sideX, y: anchor.y },
    { x: sideX, y: 184 }, { x: index % 2 ? 418 : 22, y: 184 }],
  alpha * motion.assembly * state.focus, state.selected.status === 'outside' ? 1 : .25, state.elapsed, 1.5);
}

/**
 * Portrait composition: full-size readings in two columns instead of a shrunken widescreen.
 * 구역 순회(2.5~21.5s)와 이력 차트(23~34s)만 그린다 — 35초(ENVIRONMENT_TIMING.heatmapStart)부터는
 * drawWaveFilm.ts 가 이 함수를 부르지 않고 SmtLineExplorer(3D) 가 세로 화면에서도 화면을 덮는다
 * (Round 6). 예전엔 이 함수 안에서 35초 이후 온도 히트맵을 2D 로 직접 그렸는데(drawMobileHeatmap),
 * 이제 호출부가 그 구간을 걸러내므로 그 코드는 죽은 코드가 되어 걷어냈다.
 */
export function drawEnvironmentMobile(ctx: CanvasRenderingContext2D, width: number, height: number,
  fonts: FilmFonts, frame: ZoneEnvironmentState, data: ZoneEnvironmentData, demo: boolean, insets?: FilmViewportInsets) {
  // 세로 구성은 가로의 drawCornerField 처럼 배경을 깔아 주는 함수를 거치지 않는다 — 여기서 직접
  // 물리 픽셀 전체를 불투명하게 덮어야 한다. environmentViewportTransform 은 scale/offset 만 주고
  // beginFilmViewport 처럼 화면 끝까지 늘린 경계를 주지 않으므로, 변환을 걸기 전 항등 좌표계에서
  // 채운다. 이 한 줄이 없으면 캔버스가 프레임마다 초기화되지 않아, 질감 패스(블룸 screen 합성·그레인)가
  // 반투명하게 덧칠한 결과가 계속 누적되어 1초 안에 화면 전체가 하얗게 탈색된다
  // ("모바일 온습도 화면 색상이상"의 원인). 색은 drawCornerField 의 기본 배경과 같은 값이다.
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#040b10';
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
  const view = environmentViewportTransform(width, height, insets);
  ctx.setTransform(view.scale, 0, 0, view.scale, view.offsetX, view.offsetY);
  const state = environmentMobileState(frame);
  const text = (value: string, x: number, y: number, size: number, alpha = 1) =>
    filmText(ctx, fonts, value, x, y, size, alpha * state.reveal);
  text('ENVIRONMENT / ZONE MONITOR', 26, 22, 13, .7);
  text(state.elapsed >= ENVIRONMENT_TIMING.chartsStart ? '구역별 24시간 온도 변화' : data.title, 26, 51, 21);
  const statuses = state.zones.map(item => item.status);
  text(`${state.zones.length} ZONES  ·  범위 내 ${statuses.filter(s => s === 'normal').length} / 이탈 ${statuses.filter(s => s === 'outside').length} / 미확인 ${statuses.filter(s => s === 'missing').length}`, 26, 76, 12, .8);
  drawEnvironmentZones(ctx, fonts, state, environmentMobileHistoryLayout);
  drawMobileFocus(ctx, fonts, state);
  if (!state.zones.length) text('ZONE 데이터 대기 중', 100, 450, 23, .9);
  text(state.elapsed >= ENVIRONMENT_TIMING.chartsStart ? '공통 온도 눈금 · 점선은 관리 범위'
    : demo ? '시연 데이터 · 온도 / 습도 관리 범위 예시' : '전달 데이터 · 최근 24시간', 26, 1020, 12, .65);
  ctx.strokeStyle = signalColor(.2, state.reveal * .25); ctx.lineWidth = .6;
  ctx.beginPath(); ctx.moveTo(26, 87); ctx.lineTo(414, 87); ctx.stroke();
}
