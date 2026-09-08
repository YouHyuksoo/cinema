import { drawCornerField } from './components/drawCornerField';
import { drawProductCutaway } from './components/drawProductCutaway';
import { DEFAULT_FONTS, filmText, signalColor, smooth, type FilmFonts } from './filmDrawing';
import { beginFilmViewport, type FilmViewportInsets } from './filmViewport';
import { createHoloProjection } from './holoSpace';
import { DEFAULT_PRODUCT_DATA, PRODUCT_ZONES, inspectProductMeasurement, productInspectionResult,
  productInspectionState, productZoneAnchor, type ProductInspectionData, type ProductMeasurement } from './productInspection';

function measurementText(value: number, measurement: ProductMeasurement) {
  return Number.isFinite(value) ? value.toFixed(Math.max(0, Math.min(6, Math.trunc(measurement.decimals) || 0))) : '—';
}

/** A tolerance band stays quantitative: the marker is the actual deviation, including failures. */
function drawToleranceBand(ctx: CanvasRenderingContext2D, fonts: FilmFonts, measurement: ProductMeasurement,
  x: number, y: number, opacity: number) {
  const result = inspectProductMeasurement(measurement);
  if (result.verdict === 'unavailable') return;
  const half = 104, limit = 67;
  const ratio = measurement.tolerance === 0 ? result.deviation === 0 ? 0 : Math.sign(result.deviation!) * 1.55
    : result.deviation! / measurement.tolerance;
  const position = x + Math.max(-1.55, Math.min(1.55, ratio)) * limit;
  ctx.save(); ctx.globalAlpha = opacity;
  ctx.fillStyle = signalColor(.1, .07); ctx.fillRect(x - half, y - 10, half * 2, 20);
  ctx.fillStyle = signalColor(.04, .17); ctx.fillRect(x - limit, y - 10, limit * 2, 20);
  for (const offset of [-limit, 0, limit]) {
    ctx.beginPath(); ctx.moveTo(x + offset, y - 14); ctx.lineTo(x + offset, y + 14);
    ctx.strokeStyle = signalColor(.1, offset === 0 ? .55 : .26); ctx.lineWidth = 1; ctx.stroke();
  }
  ctx.fillStyle = signalColor(result.verdict === 'fail' ? 1 : 0, .95);
  ctx.beginPath(); ctx.moveTo(position, y - 9); ctx.lineTo(position + 5, y);
  ctx.lineTo(position, y + 9); ctx.lineTo(position - 5, y); ctx.closePath(); ctx.fill();
  ctx.restore();
  filmText(ctx, fonts, '−공차', x - limit, y + 34, 10, opacity * .6, false, 'center');
  filmText(ctx, fonts, '기준', x, y + 34, 10, opacity * .65, false, 'center');
  filmText(ctx, fonts, '+공차', x + limit, y + 34, 10, opacity * .6, false, 'center');
}

export function drawProductInspectionFilm(ctx: CanvasRenderingContext2D, width: number, height: number, time: number,
  fonts: FilmFonts = DEFAULT_FONTS, insets?: FilmViewportInsets, data: ProductInspectionData = DEFAULT_PRODUCT_DATA) {
  const view = beginFilmViewport(ctx, width, height, insets);
  const state = productInspectionState(time);
  drawCornerField(ctx, view, state.elapsed, state.focus);
  const project = createHoloProjection({ x: 610, y: 367, yaw: state.yaw, pitch: state.pitch,
    scale: state.scale, panX: state.panX, panY: state.panY });
  const selected = data.measurements.find(item => item.zone === state.activeZone);
  const result = selected ? inspectProductMeasurement(selected) : null;
  const heat = result?.verdict === 'fail' ? 1 : .08;
  drawProductCutaway(ctx, project, state, heat);

  const presence = state.reveal;
  filmText(ctx, fonts, 'PRODUCT / INTERNAL INSPECTION', 72, 76, 14, presence * .8, true);
  filmText(ctx, fonts, '외피를 열고, 숨겨진 오차를 읽습니다', 72, 101, 12, presence * .54);
  filmText(ctx, fonts, data.serial, 72, 124, 11, presence * .6, true);
  filmText(ctx, fonts, data.name, 1208, 102, 13, presence * .76, false, 'right');

  if (state.activeZone) {
    const anchor = project(productZoneAnchor(state.activeZone, state.explode));
    const left = state.activeZone === 'winding';
    const x = left ? 76 : 938, edge = left ? x + 215 : x;
    const y = left ? 250 : 233;
    const reveal = state.detailReveal * (1 - smooth(6, 7, state.localTime));
    const lineEnd = edge + (left ? 14 : -14);
    ctx.save(); ctx.globalAlpha = reveal;
    ctx.beginPath(); ctx.moveTo(anchor.x, anchor.y);
    ctx.lineTo(lineEnd + (left ? 22 : -22), y + 29); ctx.lineTo(edge, y + 29);
    ctx.lineWidth = 1.1; ctx.strokeStyle = signalColor(heat, .47); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y + 29); ctx.lineTo(x + 216, y + 29);
    ctx.lineWidth = 2.1; ctx.strokeStyle = signalColor(heat, .74); ctx.stroke();
    ctx.restore();
    filmText(ctx, fonts, `0${state.inspection! + 1} / OPTICAL METROLOGY`, x, y - 19, 10, reveal * .57, true);
    filmText(ctx, fonts, selected?.label ?? '검사 데이터 없음', x, y + 11, 20, reveal * .95);
    if (selected) {
      const status = result?.verdict === 'pass' ? 'PASS / 적합'
        : result?.verdict === 'fail' ? 'FAIL / 공차 초과' : 'NO DATA / 측정 확인';
      filmText(ctx, fonts, measurementText(selected.actual, selected), x, y + 83, 39, reveal, true);
      filmText(ctx, fonts, selected.unit, x + 211, y + 82, 15, reveal * .66, true, 'right');
      filmText(ctx, fonts, `기준 ${measurementText(selected.nominal, selected)} ± ${measurementText(selected.tolerance, selected)} ${selected.unit}`,
        x, y + 114, 12, reveal * .72, true);
      filmText(ctx, fonts, status, x, y + 147, 15, reveal, true, 'left', signalColor(heat, 1));
      drawToleranceBand(ctx, fonts, selected, x + 108, y + 182, reveal * .86);
      if (result?.verdict === 'fail') {
        filmText(ctx, fonts, `허용 범위보다 ${measurementText(result.excess!, selected)} ${selected.unit} 초과`,
          x, y + 243, 12, reveal * .86, false, 'left', signalColor(1, 1));
      }
    } else filmText(ctx, fonts, '측정값을 연결하면 판정을 표시합니다.', x, y + 65, 12, reveal * .7);
  }

  // End-state verdicts refer to the connected data rather than a fixed decorative PASS label.
  const summary = productInspectionResult(data);
  if (state.finale > 0) {
    const text = summary.unavailable ? `측정 확인 ${summary.unavailable}개 · 적합 ${summary.passed} / ${summary.total}`
      : summary.failed ? `공차 이탈 ${summary.failed}개 · 재검사 필요` : `전체 ${summary.total}개 항목 적합`;
    filmText(ctx, fonts, text, 640, 567, 23, state.finale, false, 'center', signalColor(summary.failed ? 1 : 0, 1));
    filmText(ctx, fonts, 'INSPECTION COMPLETE / PARTS REMAIN TRACEABLE', 640, 596, 10,
      state.finale * .64, true, 'center');
  } else {
    const instruction = state.elapsed < 2.8 ? '제품을 불러옵니다 · 정밀 구동 모듈'
      : state.elapsed < 7 ? '외피 분리 · 내부 구조 투과 분석'
        : state.elapsed >= 28 ? '검사 결과 종합 · 각 부위의 측정 기록을 모읍니다'
        : `${state.inspection! + 1} / 3 · 검사 위치로 접근 · 실제 측정값과 공차 비교`;
    filmText(ctx, fonts, instruction, 640, 568, 14, presence * .76, false, 'center');
  }

  PRODUCT_ZONES.forEach((zone, index) => {
    const measurement = data.measurements.find(item => item.zone === zone);
    const verdict = measurement ? inspectProductMeasurement(measurement).verdict : 'unavailable';
    const inspected = state.elapsed >= 9.2 + index * 7;
    const active = state.activeZone === zone;
    const x = 356 + index * 283, y = 634;
    const opacity = presence * (active ? 1 : inspected ? .8 : .35);
    ctx.save(); ctx.globalAlpha = opacity;
    ctx.beginPath(); ctx.arc(x - 19, y - 4, 7, 0, Math.PI * 2);
    ctx.strokeStyle = signalColor(inspected && verdict === 'fail' ? 1 : 0, .75); ctx.lineWidth = 1.6; ctx.stroke();
    if (inspected) { ctx.fillStyle = signalColor(verdict === 'fail' ? 1 : 0, .45); ctx.fill(); }
    ctx.restore();
    filmText(ctx, fonts, measurement?.label ?? zone, x, y, 13, opacity);
    filmText(ctx, fonts, inspected ? verdict === 'pass' ? 'PASS' : verdict === 'fail' ? 'FAIL' : 'NO DATA' : 'PENDING',
      x, y + 22, 10, opacity * .7, true, 'left', signalColor(inspected && verdict === 'fail' ? 1 : 0, 1));
  });
  filmText(ctx, fonts, 'SIMULATION / SAMPLE MEASUREMENTS', 72, 697, 10, presence * .45, true);
}
