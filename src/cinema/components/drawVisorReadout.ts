import { filmText, signalColor, smooth, type FilmFonts } from '../filmDrawing';
import { drawInfoPanel } from './drawInfoPanel';
import { drawRotor } from './drawRotor';

const INSPECTED = 1280;
const DEFECTIVE = 18;
const TAU = Math.PI * 2;
const QUALITY_RING = { x: 180, y: 153, outer: 85, inner: 69 };
const THERMAL_PANEL = { x: 12, y: 49, width: 336, height: 222 };
const PRODUCTION_AXIS = { left: 76, top: 68 };

export const VISOR_READOUT_DATA = {
  thermal: { temperature: 94.6, baseline: 78.2, fanPercent: 82, status: '냉각 확인' },
  quality: { inspected: INSPECTED, defective: DEFECTIVE, accepted: INSPECTED - DEFECTIVE,
    yieldPercent: (INSPECTED - DEFECTIVE) / INSPECTED * 100 },
  production: { target: 900, maxValue: 1000, unit: 'EA', lines: [
    { label: '08–09시', value: 860 }, { label: '09–10시', value: 720 }, { label: '10–11시', value: 940 },
  ] },
} as const;

export type VisorReadoutKind = keyof typeof VISOR_READOUT_DATA;

/** Tethers terminate on the drawn shape, using the same coordinates as its geometry. */
export function visorReadoutAnchor(kind: VisorReadoutKind, x: number, y: number) {
  if (kind === 'quality') return { x: x + QUALITY_RING.x - QUALITY_RING.outer, y: y + QUALITY_RING.y };
  if (kind === 'production') return { x: x + PRODUCTION_AXIS.left, y: y + PRODUCTION_AXIS.top };
  return { x: x + THERMAL_PANEL.x, y: y + THERMAL_PANEL.y + 24 };
}
export interface VisorReadoutOptions {
  kind: VisorReadoutKind;
  x: number;
  y: number;
  time: number;
  opacity: number;
  heat: number;
  equipmentLabel?: string;
}

type ReadoutText = (value: string, x: number, y: number, size: number,
  strength?: number, heat?: number, mono?: boolean, align?: CanvasTextAlign) => void;

function thermalReadout(ctx: CanvasRenderingContext2D, fonts: FilmFonts, time: number, text: ReadoutText, label = 'THERMAL / SMT 03') {
  const data = VISOR_READOUT_DATA.thermal;
  text(label, 12, 23, 14, .9, 0, true);
  drawInfoPanel(ctx, fonts, {
    ...THERMAL_PANEL, time: time * 1.12, title: 'THERMAL TELEMETRY',
    focus: 0, charsPerSecond: 120, frameVariant: 'sensor',
    lines: [
      { label: '공정 온도', value: `${data.temperature.toFixed(1)}°C`, warning: true },
      { label: '기준 온도', value: `${data.baseline.toFixed(1)}°C` },
      { label: '냉각 팬', value: `${data.fanPercent}%` },
      { label: '점검', value: data.status, warning: true },
    ],
  });
  const read = smooth(2.1, 2.8, time);
  text(`기준 대비 +${(data.temperature - data.baseline).toFixed(1)}°C · 냉각 계통 점검`, 18, 290, 11, read * .8, 1);
}

function ringFace(ctx: CanvasRenderingContext2D, cx: number, cy: number, outer: number, inner: number,
  start: number, end: number) {
  ctx.beginPath();
  ctx.arc(cx, cy, outer, start, end);
  ctx.arc(cx, cy, inner, end, start, true);
  ctx.closePath();
}

function qualityReadout(ctx: CanvasRenderingContext2D, time: number, text: ReadoutText, label = 'QUALITY / SMT 04') {
  const data = VISOR_READOUT_DATA.quality;
  const growth = smooth(.4, 2.1, time);
  const { x: cx, y: cy, outer, inner } = QUALITY_RING;
  const dx = 3, dy = 7;
  const start = -Math.PI / 2;
  const goodEnd = start + TAU * data.yieldPercent / 100 * growth;
  text(label, 12, 23, 14, .9, 0, true);
  drawRotor(ctx, { x: cx, y: cy, radius: 109, time, speed: .8,
    reveal: smooth(.1, 1.6, time), variant: 'segments' });

  ctx.save(); ctx.globalAlpha *= growth;
  ringFace(ctx, cx + dx, cy + dy, outer, inner, start, start + TAU);
  ctx.fillStyle = signalColor(0, .055); ctx.fill();
  ctx.strokeStyle = signalColor(0, .25); ctx.lineWidth = .8; ctx.stroke();

  // The lower outer wall and upper inner wall reveal a hollow, transparent solid.
  ctx.beginPath(); ctx.arc(cx, cy, outer, 0, Math.PI);
  ctx.arc(cx + dx, cy + dy, outer, Math.PI, 0, true); ctx.closePath();
  ctx.fillStyle = signalColor(0, .15); ctx.fill();
  ctx.strokeStyle = signalColor(0, .32); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, inner, Math.PI, TAU);
  ctx.arc(cx + dx, cy + dy, inner, TAU, Math.PI, true); ctx.closePath();
  ctx.fillStyle = signalColor(0, .09); ctx.fill(); ctx.stroke();
  ctx.restore();

  if (growth > 0) {
    ringFace(ctx, cx, cy, outer, inner, start, goodEnd);
    const face = ctx.createLinearGradient(cx - outer, cy - outer, cx + outer, cy + outer);
    face.addColorStop(0, signalColor(0, .36)); face.addColorStop(.45, signalColor(0, .09));
    face.addColorStop(1, signalColor(0, .26));
    ctx.fillStyle = face; ctx.fill(); ctx.strokeStyle = signalColor(0, .83); ctx.lineWidth = 1; ctx.stroke();
    ringFace(ctx, cx, cy, outer, inner, goodEnd, start + TAU * growth);
    ctx.fillStyle = signalColor(1, .56); ctx.fill(); ctx.strokeStyle = signalColor(1, .95); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, outer - 2, start + .12, start + .12 + (Math.PI * .48) * growth);
    ctx.strokeStyle = signalColor(0, .8); ctx.lineWidth = .7; ctx.stroke();
  }

  text('양품률', cx, cy - 24, 12, smooth(.5, 1.1, time) * .72, 0, false, 'center');
  text(`${(data.yieldPercent * growth).toFixed(1)}%`, cx, cy + 23, 38, smooth(.4, .9, time), 0, true, 'center');
  text(`${data.accepted.toLocaleString('en-US')} / ${data.inspected.toLocaleString('en-US')}`, cx, cy + 48, 11,
    smooth(1.7, 2.5, time) * .62, 0, true, 'center');
  const read = smooth(1.7, 2.6, time);
  text(`검사 ${data.inspected.toLocaleString('en-US')} EA`, 35, 282, 13, read * .82);
  text(`불량 ${data.defective} EA`, 225, 282, 13, read * .92, 1);
}

function productionReadout(ctx: CanvasRenderingContext2D, time: number, text: ReadoutText, label = 'OUTPUT / SMT 01') {
  const data = VISOR_READOUT_DATA.production;
  const left = PRODUCTION_AXIS.left, width = 216, top = 82, rowGap = 62, barHeight = 19, depth = 6;
  text(label, 12, 23, 14, .9, 0, true);
  text('시간대별 생산 · 시간당 목표 900 EA', 12, 45, 11, .68);

  const ruler = smooth(.1, .8, time);
  ctx.save(); ctx.globalAlpha *= ruler; ctx.setLineDash([2, 5]);
  for (const value of [0, 500, data.maxValue]) {
    const x = left + width * value / data.maxValue;
    ctx.beginPath(); ctx.moveTo(x, PRODUCTION_AXIS.top); ctx.lineTo(x, 246);
    ctx.strokeStyle = signalColor(0, value === 0 ? .36 : .12); ctx.lineWidth = .7; ctx.stroke();
  }
  const targetX = left + width * data.target / data.maxValue;
  ctx.beginPath(); ctx.moveTo(targetX, 67); ctx.lineTo(targetX, 247);
  ctx.strokeStyle = signalColor(0, .58); ctx.setLineDash([4, 4]); ctx.stroke();
  ctx.restore();

  data.lines.forEach((datum, index) => {
    const start = .35 + index * .32;
    const growth = smooth(start, start + 1.4, time);
    const y = top + rowGap * index;
    const extent = width * datum.value / data.maxValue * growth;
    const heat = datum.value < data.target ? 1 : 0;
    const visible = smooth(start, start + .2, time);
    text(datum.label, 12, y + 13, 11, visible * .76);
    text(Math.round(datum.value * growth).toLocaleString('en-US'), 346, y + 15, 20, visible * .95, heat, true, 'right');
    if (extent <= .01) return;
    const edge = left + extent;
    const fill = ctx.createLinearGradient(left, y, edge, y + barHeight);
    fill.addColorStop(0, signalColor(heat, .07)); fill.addColorStop(1, signalColor(heat, .3));
    ctx.fillStyle = fill; ctx.fillRect(left, y, extent, barHeight);
    ctx.strokeStyle = signalColor(heat, .65); ctx.lineWidth = .8; ctx.strokeRect(left, y, extent, barHeight);
    ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(left + depth, y - depth);
    ctx.lineTo(edge + depth, y - depth); ctx.lineTo(edge, y); ctx.closePath();
    ctx.fillStyle = signalColor(heat, .22); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(edge, y); ctx.lineTo(edge + depth, y - depth);
    ctx.lineTo(edge + depth, y + barHeight - depth); ctx.lineTo(edge, y + barHeight); ctx.closePath();
    ctx.fillStyle = signalColor(heat, .36); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(left + 1, y + 1); ctx.lineTo(edge - 1, y + 1);
    ctx.strokeStyle = signalColor(heat, .86); ctx.lineWidth = 1; ctx.stroke();
  });

  for (const value of [0, 500, data.maxValue]) {
    text(value.toLocaleString('en-US'), left + width * value / data.maxValue, 267, 10, ruler * .6, 0, true, 'center');
  }
  text('EA', 346, 267, 10, ruler * .48, 0, true, 'right');
  const belowTarget = data.lines.filter(datum => datum.value < data.target).length;
  text(`목표 미달 ${belowTarget}개 시간대`, 12, 291, 12, smooth(2, 2.7, time) * .85, 1);
  text('동일 기준 0–1,000 EA', 346, 291, 10, smooth(2, 2.7, time) * .6, 0, false, 'right');
}

/** Three readings share one bounded annotation plane; the caller owns its perspective and zoom. */
export function drawVisorReadout(ctx: CanvasRenderingContext2D, fonts: FilmFonts, options: VisorReadoutOptions) {
  const { kind, x, y, time, opacity, heat } = options;
  if (![x, y, time, opacity, heat].every(Number.isFinite) || time < 0 || opacity <= 0) return;
  ctx.save(); ctx.translate(x, y);
  ctx.beginPath(); ctx.rect(0, 0, 360, 320); ctx.clip();
  ctx.globalAlpha *= Math.min(1, opacity) * smooth(0, .3, time);
  ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0;
  ctx.setLineDash([]); ctx.lineCap = 'butt'; ctx.lineJoin = 'round'; ctx.textBaseline = 'alphabetic';
  const alpha = ctx.globalAlpha;
  const text: ReadoutText = (value, px, py, size, strength = 1, warmth = 0, mono = false, align = 'left') =>
    filmText(ctx, fonts, value, px, py, size, alpha * strength, mono, align, signalColor(warmth, 1));
  if (kind === 'thermal') thermalReadout(ctx, fonts, time, text, options.equipmentLabel);
  else if (kind === 'quality') qualityReadout(ctx, time, text, options.equipmentLabel);
  else if (kind === 'production') productionReadout(ctx, time, text, options.equipmentLabel);
  text('SIMULATION / 시뮬레이션 데이터', 12, 312, 9, .46, Math.max(0, Math.min(1, heat)) * .18, true);
  ctx.restore();
}
