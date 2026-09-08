import { drawCornerField } from './components/drawCornerField';
import { drawProcessNetwork } from './components/drawProcessNetwork';
import { DEFAULT_FONTS, filmText, signalColor, type FilmFonts } from './filmDrawing';
import { beginFilmViewport, type FilmViewportInsets } from './filmViewport';
import { DEFAULT_PROCESS_DATA, processNetworkState, type ProcessNetworkData } from './processNetwork';

export function drawProcessNetworkFilm(ctx: CanvasRenderingContext2D, width: number, height: number, time: number,
  fonts: FilmFonts = DEFAULT_FONTS, insets?: FilmViewportInsets, data: ProcessNetworkData = DEFAULT_PROCESS_DATA) {
  const view = beginFilmViewport(ctx, width, height, insets);
  const state = processNetworkState(time, data);
  drawCornerField(ctx, view, state.time, state.focus);
  drawProcessNetwork(ctx, fonts, { data, state });
  filmText(ctx, fonts, 'LIVING / PROCESS NETWORK', 72, 76, 14, state.opacity * .8, true);
  filmText(ctx, fonts, '빛으로 이어지는 생산 · 정체를 찾아 가까이 읽습니다', 72, 102, 12, state.opacity * .5);
  filmText(ctx, fonts, data.title, 72, 123, 10, state.opacity * .45, true);
  const phase = state.time < 6 ? '01   생산 흐름 연결' : state.time < 10 ? '02   대기 밀집 구간으로 접근'
    : state.time < 21 ? '03   병목 원인 분석' : state.time < 28 ? state.target?.node.recovery
      ? state.flowRecovered ? '04   회복된 흐름 확인' : '04   대기 분산 · 흐름 회복 중'
      : '04   병목 이후의 흐름 추적' : '05   전체 공정으로 복귀';
  filmText(ctx, fonts, phase, 640, 610, 15, state.opacity * .86, false, 'center');
  filmText(ctx, fonts, `라인 처리 능력 ${Math.round(state.lineCapacity)} EA/h  ·  목표 ${data.demandPerHour} EA/h`,
    640, 635, 12, state.opacity * .55, true, 'center');
  filmText(ctx, fonts, 'PROCESS TELEMETRY / SIMULATION', 72, 689, 10, state.opacity * .46, true);
  ctx.save(); ctx.globalAlpha = state.opacity;
  for (let index = 0; index < 5; index++) {
    ctx.fillStyle = signalColor(index === 2 && !state.flowRecovered ? .8 : 0, state.time / 6.4 >= index ? .65 : .1);
    ctx.fillRect(1132 + index * 16, 680, 10, 3);
  }
  ctx.restore();
}
