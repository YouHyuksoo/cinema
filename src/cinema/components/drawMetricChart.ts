import { CORNER_PRODUCTION } from '../cornerSequence';
import { filmText, signalColor, smooth, type FilmFonts } from '../filmDrawing';
import type { UnfoldMetric } from '../unfoldMetrics';

type ChartInk = {
  line: (points: readonly (readonly [number, number])[], strength?: number, heat?: number, width?: number) => void;
  text: (value: string, x: number, y: number, size?: number, strength?: number,
    heat?: number, align?: CanvasTextAlign, mono?: boolean) => void;
};

const LEFT = -310, RIGHT = 310, WIDTH = RIGHT - LEFT;
const ratio = CORNER_PRODUCTION.actual / CORNER_PRODUCTION.target;
const productionEnd = LEFT + WIDTH * ratio;

function drawBalanceTrack(ctx: CanvasRenderingContext2D, ink: ChartInk, reveal: number) {
  const end = LEFT + WIDTH * reveal;
  ink.line([[LEFT, -34], [end, -34]], .38);
  ink.line([[LEFT, 34], [end, 34]], .38);
  ink.line([[LEFT, -34], [LEFT, 34]], .5);
  if (reveal > .99) ink.line([[RIGHT, -34], [RIGHT, 34]], .5);
  for (let i = 0; i <= 20; i += 1) {
    if (i / 20 > reveal) continue;
    const x = LEFT + WIDTH * i / 20;
    ink.line([[x, 40], [x, i % 5 === 0 ? 51 : 45]], i % 5 === 0 ? .5 : .22);
  }
  ctx.fillStyle = signalColor(0, .025);
  ctx.fillRect(LEFT, -34, WIDTH * reveal, 68);
}

function drawProduction(ctx: CanvasRenderingContext2D, ink: ChartInk, reveal: number) {
  drawBalanceTrack(ctx, ink, reveal);
  const topEnd = LEFT + (productionEnd - LEFT) * reveal;
  ink.line([[LEFT, -34], [LEFT + 6, -40], [topEnd + 6, -40], [topEnd, -34]], .55);
  if (reveal > .9) {
    ink.line([[productionEnd, -49], [productionEnd, 41]], .95, 0, 1.6);
    ctx.fillStyle = signalColor(0, .9);
    ctx.beginPath(); ctx.moveTo(productionEnd - 5, -55); ctx.lineTo(productionEnd + 5, -55);
    ctx.lineTo(productionEnd, -48); ctx.closePath(); ctx.fill();
  }
  ink.text('실적', LEFT, -76, 17, .64);
  ink.text(CORNER_PRODUCTION.actual.toLocaleString('en-US'), LEFT + 54, -67, 36, 1, 0, 'left', true);
  ink.text('EA', LEFT + 177, -71, 17, .6, 0, 'left', true);
  ink.text('0', LEFT, 80, 17, .48, 0, 'left', true);
  ink.text(`계획 ${CORNER_PRODUCTION.target.toLocaleString('en-US')} EA`, RIGHT, 80, 20, .8, 0, 'right');
  ink.text(`${(ratio * 100).toFixed(1)}%`, RIGHT, -70, 31, .95, 0, 'right', true);
}

function drawQuality(ctx: CanvasRenderingContext2D, ink: ChartInk, metric: UnfoldMetric, reveal: number) {
  const cx = -90, cy = 10, angle = (value: number) => -Math.PI / 2 + value / 100 * Math.PI * 2;
  for (const radius of [78, 88, 105]) {
    ctx.beginPath(); ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * reveal);
    ctx.strokeStyle = signalColor(0, radius === 105 ? .22 : .14); ctx.lineWidth = .7; ctx.stroke();
  }
  for (let i = 0; i < 100 * reveal; i += 1) {
    const theta = angle(i), major = i % 10 === 0;
    ink.line([[cx + Math.cos(theta) * 101, cy + Math.sin(theta) * 101],
      [cx + Math.cos(theta) * (major ? 105 : 103), cy + Math.sin(theta) * (major ? 105 : 103)]],
    major ? .72 : .33, i >= metric.numericValue ? 1 : 0, major ? 1.2 : .7);
  }
  const baseline = angle(metric.baseline);
  ctx.setLineDash([3, 3]);
  ink.line([[cx + Math.cos(baseline) * 72, cy + Math.sin(baseline) * 72],
    [cx + Math.cos(baseline) * 105, cy + Math.sin(baseline) * 105]], .9, 1, 1.3);
  ctx.setLineDash([]);
  ink.text('양품', cx, 5, 18, .65, 0, 'center');
  ink.text('FPY', cx, 32, 23, .9, 0, 'center', true);
  ink.text(`${metric.numericValue.toFixed(1)}%`, 70, -29, 45, 1, 0, 'left', true);
  ink.text(`기준 ${metric.baseline.toFixed(1)}%`, 72, 12, 21, .72);
  ink.text(`차이 ${(metric.numericValue - metric.baseline).toFixed(1).replace('-', '−')}%p`, 72, 49, 25, .95, 1);
  ink.line([[72, 69], [RIGHT, 69]], .24, 1);
  ink.text(`불량 비율 ${(100 - metric.numericValue).toFixed(1)}%`, 72, 98, 19, .82, 1);
}

function drawCycle(ctx: CanvasRenderingContext2D, ink: ChartInk, metric: UnfoldMetric,
  reveal: number, time: number) {
  const position = (value: number) => LEFT + WIDTH * value / 10;
  const end = position(metric.numericValue), baseline = position(metric.baseline);
  ink.line([[LEFT, -25], [LEFT + (end - LEFT) * reveal, -25]], .65);
  ink.line([[LEFT, 25], [LEFT + (end - LEFT) * reveal, 25]], .65);
  ink.line([[LEFT, 44], [LEFT + WIDTH * reveal, 44]], .34);
  for (let i = 0; i <= 20; i += 1) {
    if (i / 20 > reveal) continue;
    const x = position(i / 2), major = i % 2 === 0;
    ink.line([[x, 44], [x, major ? 56 : 50]], major ? .58 : .26, x > baseline ? 1 : 0);
    if (major) ink.text(String(i / 2), x, 78, 17, .6, x > baseline ? 1 : 0, 'center', true);
  }
  ctx.setLineDash([4, 4]);
  ink.line([[baseline, -48], [baseline, 35]], .8, 0, 1.3);
  ctx.setLineDash([]);
  ink.line([[end, -37], [end, 35]], 1, 1, 2);
  ink.line([[baseline, -42], [end, -42]], .65, 1);
  ink.line([[baseline, -46], [baseline, -38]], .8, 1);
  ink.line([[end, -46], [end, -38]], .8, 1);
  // A moving scan line expresses elapsed scene time without inventing a measurement history.
  const scan = position(((Math.max(0, time) % metric.numericValue) / metric.numericValue) * metric.numericValue);
  if (scan < end && reveal > .9) ink.line([[scan, -20], [scan, 20]], .45, scan > baseline ? 1 : 0, 1.5);
  ink.text(`실측 ${metric.numericValue.toFixed(1)} s`, LEFT, -67, 32, 1, 1);
  ink.text(`기준 ${metric.baseline.toFixed(1)} s`, RIGHT, -70, 22, .8, 0, 'right');
  ink.text(`기준 대비 +${(metric.numericValue - metric.baseline).toFixed(1)} s`, 0, 112, 24, .9, 1, 'center');
}

function drawRemaining(ctx: CanvasRenderingContext2D, ink: ChartInk, reveal: number) {
  drawBalanceTrack(ctx, ink, reveal);
  ink.line([[productionEnd, -45], [productionEnd, 44]], .86, 1, 1.5);
  ink.line([[productionEnd, -42], [RIGHT, -42]], .68, 1);
  ink.line([[RIGHT, -46], [RIGHT, -38]], .8, 1);
  ink.text('생산 실적', LEFT, -76, 18, .63);
  ink.text(`${CORNER_PRODUCTION.actual.toLocaleString('en-US')} EA`, LEFT, -49, 26, .97, 0, 'left', true);
  ink.text(`잔여 ${CORNER_PRODUCTION.remaining} EA`, RIGHT, -63, 30, 1, 1, 'right');
  ink.text(`${(ratio * 100).toFixed(1)}% 완료`, LEFT, 81, 24, .92);
  ink.text(`${(100 - ratio * 100).toFixed(1)}% 잔여`, RIGHT, 81, 24, .94, 1, 'right');
  ink.text(`계획 ${CORNER_PRODUCTION.target.toLocaleString('en-US')} = 실적 ${CORNER_PRODUCTION.actual.toLocaleString('en-US')} + 잔여 ${CORNER_PRODUCTION.remaining}`, 0, 112, 19, .64, 0, 'center');
}

/** Chart guides share the particle morph coordinates; the caller owns all card placement. */
export function drawMetricChart(ctx: CanvasRenderingContext2D, fonts: FilmFonts,
  metric: UnfoldMetric, reveal: number, opacity: number, time: number) {
  const progress = Math.max(0, Math.min(1, reveal));
  const alpha = Math.max(0, Math.min(1, opacity)) * smooth(0, .65, progress);
  if (alpha <= .001) return;
  ctx.save(); ctx.globalAlpha = alpha; ctx.lineCap = 'butt'; ctx.lineJoin = 'round';
  const textOpacity = alpha * smooth(.32, .92, progress);
  const ink: ChartInk = {
    line(points, strength = .6, heat = 0, width = 1) {
      if (points.length < 2) return;
      ctx.beginPath(); ctx.moveTo(...points[0]);
      for (const point of points.slice(1)) ctx.lineTo(...point);
      ctx.strokeStyle = signalColor(heat, strength); ctx.lineWidth = width; ctx.stroke();
    },
    text(value, x, y, size = 20, strength = 1, heat = 0, align = 'left', mono = false) {
      filmText(ctx, fonts, value, x, y, size, textOpacity * strength, mono, align, signalColor(heat, 1));
    },
  };
  switch (metric.id) {
    case 'production': drawProduction(ctx, ink, progress); break;
    case 'quality': drawQuality(ctx, ink, metric, progress); break;
    case 'cycle': drawCycle(ctx, ink, metric, progress, time); break;
    case 'remaining': drawRemaining(ctx, ink, progress); break;
  }
  ctx.restore();
}
