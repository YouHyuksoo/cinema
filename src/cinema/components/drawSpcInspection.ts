import { filmText, signalColor, smooth, type FilmFonts } from '../filmDrawing';
import type { SpcData, ValidSpcAnalysis } from '../spcTypes';
import { spcTraceHead } from '../spcScene';
import { infoPanelFrame } from './infoPanelFrame';

interface SpcInspectionState {
  time: number;
  focus: number;
  opacity: number;
  anchor?: { x: number; y: number };
}

type Point = readonly [number, number];

/** A transparent measurement lens, always backed by the selected subgroup's real readings. */
export function drawSpcInspection(ctx: CanvasRenderingContext2D, fonts: FilmFonts, data: SpcData,
  analysis: ValidSpcAnalysis, state: SpcInspectionState) {
  if (state.opacity <= .001) return;
  const opacity = Math.max(0, Math.min(1, state.opacity));
  const focus = Math.max(0, Math.min(1, state.focus));
  const detail = smooth(.24, .76, focus), collecting = 1 - smooth(.04, .24, focus);
  const selected = analysis.focusGroupIndex, group = data.subgroups[selected];
  const rawSpan = Math.max(...group.values) - Math.min(...group.values);
  const precision = Math.max(4, Math.min(8, Math.ceil(-Math.log10(Math.max(rawSpan,
    analysis.histogram.binWidth, Number.EPSILON))) + 2));
  const numeric = (value: number) => Number.isFinite(value) ? value.toFixed(precision) : '—';
  const focusedR = analysis.r.violations[selected];
  const series = focusedR ? analysis.r : analysis.xbar;
  const selectedValue = series.values[selected], violated = series.violations[selected];
  const heat = violated ? 1 : 0;
  const left = 820, top = 176, width = 378, height = 378;
  const inner = left + 25, right = left + width - 31;
  const text = (value: string, x: number, y: number, size: number, strength = 1, warmth = 0,
    align: CanvasTextAlign = 'left', mono = false) =>
    filmText(ctx, fonts, value, x, y, size, opacity * strength, mono, align, signalColor(warmth, 1));
  const line = (points: readonly Point[], strength: number, warmth = 0, weight = 1) => {
    ctx.beginPath();
    points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.strokeStyle = signalColor(warmth, strength); ctx.lineWidth = weight; ctx.stroke();
  };

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';

  // The travelling bead follows the same curve that attaches the lens to the chart sample.
  if (state.anchor && focus > .001) {
    const a = state.anchor, b = { x: a.x + 65, y: a.y - 48 };
    const c = { x: left - 48, y: 218 }, d = { x: left + 4, y: 218 };
    const curve = () => {
      ctx.beginPath(); ctx.moveTo(a.x, a.y);
      ctx.bezierCurveTo(b.x, b.y, c.x, c.y, d.x, d.y);
    };
    for (const [weight, strength] of [[9, .04], [3, .14], [1.35, .72]]) {
      curve(); ctx.strokeStyle = signalColor(heat, strength * focus); ctx.lineWidth = weight; ctx.stroke();
    }
    const u = ((state.time * .31) % 1 + 1) % 1, v = 1 - u;
    const bx = v ** 3 * a.x + 3 * v * v * u * b.x + 3 * v * u * u * c.x + u ** 3 * d.x;
    const by = v ** 3 * a.y + 3 * v * v * u * b.y + 3 * v * u * u * c.y + u ** 3 * d.y;
    ctx.save(); ctx.shadowBlur = 12; ctx.shadowColor = signalColor(heat, 1);
    ctx.fillStyle = signalColor(heat, .95 * focus);
    ctx.beginPath(); ctx.arc(bx, by, 2.7, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.beginPath(); ctx.arc(d.x, d.y, 4 + Math.sin(state.time * 3) * .8, 0, Math.PI * 2);
    ctx.strokeStyle = signalColor(heat, .85 * focus); ctx.lineWidth = 1; ctx.stroke();
  }

  const frame = infoPanelFrame(left, top, width, height, 'analysis');
  const outline = [...frame.outline, frame.outline[0]];
  line(outline, .045, 0, 7); line(outline, .42, 0, 1);
  for (const tab of frame.tabs) {
    ctx.beginPath(); tab.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.closePath(); ctx.fillStyle = signalColor(0, .62); ctx.fill();
  }
  frame.vents.forEach(vent => line(vent, .48));
  line([[inner, 225], [right - 58, 225]], .17);
  line([[right - 48, 225], [right, 225]], .58, heat * detail, 2);
  text('SUBGROUP / INSPECTION', inner, 211, 11, .65, 0, 'left', true);

  if (collecting > .001) {
    text(`${data.subgroups.length} × ${analysis.subgroupSize}`, inner, 321, 54, collecting, 0, 'left', true);
    text('부분군', inner, 346, 11, collecting * .54);
    text('실측값 / 군', inner + 144, 346, 11, collecting * .54);
    const acquired = Math.floor(spcTraceHead(state.time, data.subgroups.length)) + 1;
    const matrixWidth = right - inner - 4, matrixHeight = 63;
    const columnWidth = matrixWidth / data.subgroups.length;
    const rowHeight = matrixHeight / analysis.subgroupSize;
    for (let column = 0; column < data.subgroups.length; column += 1) {
      for (let row = 0; row < analysis.subgroupSize; row += 1) {
        const lit = column < acquired;
        ctx.fillStyle = signalColor(0, collecting * (lit ? .64 : .1));
        ctx.fillRect(inner + column * columnWidth, 376 + row * rowHeight,
          Math.max(.5, columnWidth - 4), Math.max(1, rowHeight - 5));
      }
    }
    text(`${acquired.toString().padStart(2, '0')} / ${data.subgroups.length} SUBGROUPS`, inner, 468, 12,
      collecting * .75, 0, 'left', true);
    text(`총 ${analysis.totalSamples}개 측정값으로 관리한계 계산`, inner, 505, 13, collecting * .7);
  }

  if (detail > .001) {
    text(`${group.id}  /  ${focusedR ? 'R 범위' : 'X̄ 평균'}`, inner, 259, 24, detail, heat);
    text(numeric(selectedValue), inner - 1, 319, 51, detail, heat, 'left', true);
    text(data.unit, right, 316, 18, detail * .64, 0, 'right', true);
    const boundary = selectedValue > series.upper ? series.upper : series.lower;
    const delta = selectedValue - boundary;
    const status = violated
      ? `${selectedValue > series.upper ? 'UCL 초과' : 'LCL 미달'}  ${delta >= 0 ? '+' : '−'}${numeric(Math.abs(delta))} ${data.unit}`
      : '3σ 관리한계 이탈 없음';
    text(status, inner, 343, 14, detail * .94, heat, 'left', violated);

    text(`원시 측정값  /  ${data.unit}`, inner, 372, 11, detail * .58);
    const min = Math.min(...group.values), max = Math.max(...group.values);
    const span = max - min;
    const xs = group.values.map((_, index) => inner + 23 + index / Math.max(1, group.values.length - 1) * (right - inner - 46));
    const points: Point[] = group.values.map((value, index) =>
      [xs[index], span > 0 ? 428 - (value - min) / span * 31 : 412]);
    line([[inner + 9, 438], [right - 9, 438]], detail * .16);
    line(points, detail * .43, 0, 1.2);
    points.forEach(([x, y], index) => {
      line([[x, 438], [x, y]], detail * .26);
      ctx.fillStyle = signalColor(0, detail * .95);
      ctx.beginPath(); ctx.arc(x, y, 3.3, 0, Math.PI * 2); ctx.fill();
      // These are individual measurements, not subgroup control-limit violations.
      text(numeric(group.values[index]), x, 459, group.values.length > 5 ? 6.5 : 11,
        detail * .9, 0, 'center', true);
    });

    line([[inner, 476], [right, 476]], detail * .16);
    const second = inner + 179;
    text('군 평균  X̄', inner, 498, 10, detail * .53);
    text('군 범위  R', second, 498, 10, detail * .53);
    text(numeric(analysis.xbar.values[selected]), inner, 525, 23, detail * .98,
      analysis.xbar.violations[selected] ? 1 : 0, 'left', true);
    text(numeric(analysis.r.values[selected]), second, 525, 23, detail * .98,
      analysis.r.violations[selected] ? 1 : 0, 'left', true);
    line([[inner + 159, 489], [inner + 159, 528]], detail * .2);
  }
  ctx.restore();
}
