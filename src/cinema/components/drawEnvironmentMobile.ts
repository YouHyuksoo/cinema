import { filmText, signalColor, type FilmFonts } from '../filmDrawing';
import { ENVIRONMENT_TIMING, environmentReadingStatus, type ZoneEnvironmentData, type ZoneEnvironmentState } from '../zoneEnvironment';
import { environmentMobileHistoryLayout, environmentMobileState, environmentViewportTransform } from '../environmentMobileLayout';
import type { FilmViewportInsets } from '../filmViewport';
import { environmentGaugeState } from '../environmentGauge';
import { environmentHeatmap, environmentTemperatureColor } from '../environmentHeatmap';
import { drawEnvironmentGauge } from './drawEnvironmentGauge';
import { drawEnvironmentHeatmap } from './drawEnvironmentHeatmap';
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

function drawMobileHeatmap(ctx: CanvasRenderingContext2D, fonts: FilmFonts, state: ZoneEnvironmentState) {
  const alpha = state.reveal * state.heatmapReveal;
  if (alpha <= .001) return;
  // Preserve the same factory flight, sensor pins and interpolation as the desktop scene.
  ctx.save(); ctx.translate(220 - 640 * .41, 108 - 190 * .41); ctx.scale(.41, .41);
  ctx.beginPath(); ctx.rect(145, 190, 990, 420); ctx.clip();
  drawEnvironmentHeatmap(ctx, fonts, state); ctx.restore();
  filmText(ctx, fonts, '센서값 보간 · 설치 공간은 예시 배치', 220, 306, 12, alpha * .7, false, 'center');
  const model = environmentHeatmap(state.zones.map(item => item.zone));
  for (const [index, room] of model.rooms.entries()) {
    const x = 26 + index % 2 * 220, y = 340 + Math.floor(index / 2) * 116;
    ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = room.color; ctx.lineWidth = .8;
    ctx.strokeRect(x, y, 168, 96);
    ctx.globalAlpha = alpha * .08; ctx.fillStyle = room.color; ctx.fillRect(x, y, 168, 96); ctx.restore();
    const text = (value: string, dx: number, dy: number, size: number, opacity = 1) =>
      filmText(ctx, fonts, value, x + dx, y + dy, size, alpha * opacity, false, 'left', room.color);
    text(room.zone.id, 10, 21, 14);
    text(room.zone.name, 10, 39, 11, .85);
    text(`${room.reading} °C`, 10, 67, 28);
    text(room.status === 'outside' ? '! 온도 범위 이탈' : room.status === 'missing' ? '온도 데이터 확인' : '온도 범위 내', 10, 86, 11, .85);
  }
  for (let segment = 0; segment < 100; segment++) {
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.fillStyle = environmentTemperatureColor(model.domain.min + (model.domain.max - model.domain.min) * segment / 99, model.domain).color;
    ctx.fillRect(50 + segment * 3.4, 939, 3.8, 6); ctx.restore();
  }
  for (let tick = 0; tick <= 4; tick++) {
    const value = model.domain.min + (model.domain.max - model.domain.min) * tick / 4;
    filmText(ctx, fonts, `${value}°C`, 50 + tick * 85, 965, 12, alpha * .9, true, 'center');
  }
}

/** Portrait composition: full-size readings in two columns instead of a shrunken widescreen. */
export function drawEnvironmentMobile(ctx: CanvasRenderingContext2D, width: number, height: number,
  fonts: FilmFonts, frame: ZoneEnvironmentState, data: ZoneEnvironmentData, demo: boolean, insets?: FilmViewportInsets) {
  const view = environmentViewportTransform(width, height, insets);
  ctx.setTransform(view.scale, 0, 0, view.scale, view.offsetX, view.offsetY);
  const state = environmentMobileState(frame), isMap = state.elapsed >= ENVIRONMENT_TIMING.heatmapStart;
  const text = (value: string, x: number, y: number, size: number, alpha = 1) =>
    filmText(ctx, fonts, value, x, y, size, alpha * state.reveal);
  text('ENVIRONMENT / ZONE MONITOR', 26, 22, 13, .7);
  text(isMap ? '센서 설치 공간 / 온도 히트맵' : state.elapsed >= ENVIRONMENT_TIMING.chartsStart ? '구역별 24시간 온도 변화' : data.title, 26, 51, 21);
  const statuses = state.zones.map(item => isMap ? environmentReadingStatus(item.zone.temperature, item.zone.temperatureRange) : item.status);
  text(`${state.zones.length} ZONES  ·  ${isMap ? '온도 ' : ''}범위 내 ${statuses.filter(s => s === 'normal').length} / 이탈 ${statuses.filter(s => s === 'outside').length} / 미확인 ${statuses.filter(s => s === 'missing').length}`, 26, 76, 12, .8);
  drawEnvironmentZones(ctx, fonts, state, environmentMobileHistoryLayout);
  drawMobileFocus(ctx, fonts, state);
  drawMobileHeatmap(ctx, fonts, state);
  if (!state.zones.length) text('ZONE 데이터 대기 중', 100, 450, 23, .9);
  if (!isMap) text(state.elapsed >= ENVIRONMENT_TIMING.chartsStart ? '공통 온도 눈금 · 점선은 관리 범위'
    : demo ? '시연 데이터 · 온도 / 습도 관리 범위 예시' : '전달 데이터 · 최근 24시간', 26, 1020, 12, .65);
  ctx.strokeStyle = signalColor(.2, state.reveal * .25); ctx.lineWidth = .6;
  ctx.beginPath(); ctx.moveTo(26, 87); ctx.lineTo(414, 87); ctx.stroke();
}
