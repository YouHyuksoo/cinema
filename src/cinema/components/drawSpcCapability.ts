import { filmText, signalColor, type FilmFonts } from '../filmDrawing';
import type { SpcData, ValidSpcAnalysis } from '../spcTypes';

/** The measurement axis exposes centering and spread against the supplied specification. */
export function drawSpcCapability(ctx: CanvasRenderingContext2D, fonts: FilmFonts,
  data: SpcData, analysis: ValidSpcAnalysis) {
  const text = (value: string, x: number, y: number, size = 12, alpha = 1,
    align: CanvasTextAlign = 'left', heat = 0) =>
    filmText(ctx, fonts, value, x, y, size, alpha, false, align, signalColor(heat, 1));
  const { mean, sigmaWithin: sigma } = analysis;
  const low = Math.min(data.lsl, mean - 4 * sigma);
  const high = Math.max(data.usl, mean + 4 * sigma);
  const pad = (high - low) * .08;
  const x = (value: number) => 16 + (value - low + pad) / (high - low + 2 * pad) * 326;
  const top = 48, bottom = 135;
  ctx.save(); ctx.shadowBlur = 0;
  text('Cpk 공정능력', 0, 0, 20);
  const shift = mean - data.nominal;
  text(`평균 ${mean.toFixed(3)}  /  목표 대비 ${shift >= 0 ? '+' : ''}${shift.toFixed(3)} ${data.unit}`, 0, 25, 12, .9);
  ctx.fillStyle = signalColor(0, .06);
  ctx.fillRect(x(data.lsl), top, x(data.usl) - x(data.lsl), bottom - top);
  ctx.strokeStyle = signalColor(0, .3); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(16, bottom); ctx.lineTo(342, bottom); ctx.stroke();
  if (sigma > 0) {
    // Fitted within-sigma normal curve; not a claim that normality has been established.
    ctx.beginPath(); ctx.moveTo(x(low - pad), bottom);
    for (let i = 0; i <= 160; i++) {
      const value = low - pad + (high - low + 2 * pad) * i / 160;
      const density = Math.exp(-.5 * ((value - mean) / sigma) ** 2);
      ctx.lineTo(x(value), bottom - density * (bottom - top - 8));
    }
    ctx.lineTo(x(high + pad), bottom); ctx.closePath();
    ctx.fillStyle = signalColor(0, .18); ctx.fill();
    ctx.strokeStyle = signalColor(0, .95); ctx.lineWidth = 1.7; ctx.stroke();
    // Shade only the portions of the fitted distribution beyond specification limits.
    ctx.save(); ctx.clip(); ctx.fillStyle = signalColor(1, .42);
    ctx.fillRect(16, top, x(data.lsl) - 16, bottom - top);
    ctx.fillRect(x(data.usl), top, 342 - x(data.usl), bottom - top); ctx.restore();
  } else text('군내 변동 0 · 분포 추정 불가', 180, 95, 13, .8, 'center');
  for (const [value, label, heat] of [[data.lsl, 'LSL', 1], [data.usl, 'USL', 1], [data.nominal, '목표', 0]] as const) {
    ctx.setLineDash([3, 3]); ctx.strokeStyle = signalColor(heat, .65); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x(value), top); ctx.lineTo(x(value), bottom); ctx.stroke();
    text(label, x(value), 43, 10, .9, 'center', heat);
    text(String(value), x(value), 151, 10, .7, 'center');
  }
  ctx.setLineDash([]); ctx.strokeStyle = signalColor(0, 1); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x(mean), top + 6); ctx.lineTo(x(mean), bottom); ctx.stroke();
  const numeric = (value: number | null) => value === null ? '—' : value.toFixed(3);
  text(`Cp ${numeric(analysis.cp)}   Cpk ${numeric(analysis.cpk)}   목표 ≥ ${data.cpkTarget}`, 0, 181, 13);
  text('실선: 평균 · 점선: 목표/규격 · 곡선: 군내 σ 정규 추정', 0, 203, 10, .7);
  text('정규성 미검증 · 관리한계 이탈 시 능력지수 참고', 0, 223, 10, .5);
  ctx.restore();
}
