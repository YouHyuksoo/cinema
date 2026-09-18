import { drawChartStage } from './drawChartStage';
import { DEFAULT_FONTS, filmText, smooth, signalColor, type FilmFonts } from './filmDrawing';
import type { FilmViewportInsets } from './filmViewport';
import { DEFAULT_OEE_DATA, OEE_SECONDS, calculateOee, type OeeData } from './oeeData';

export function drawOeeFilm(ctx: CanvasRenderingContext2D, width: number, height: number, time: number,
  fonts: FilmFonts = DEFAULT_FONTS, insets?: FilmViewportInsets, data: OeeData = DEFAULT_OEE_DATA) {
  drawChartStage(ctx, width, height, time, fonts, 'OEE / OVERALL EQUIPMENT EFFECTIVENESS', insets);
  const t = Math.max(0, time) % OEE_SECONDS, segment = OEE_SECONDS / Math.max(1, data.equipment.length);
  const index = Math.min(data.equipment.length - 1, Math.floor(t / segment));
  const item = data.equipment[index], result = item && calculateOee(item);
  const age = (t % segment) / segment * 6, reveal = smooth(0, .7, age);
  const text = (value: string, x: number, y: number, size = 14, alpha = 1, align: CanvasTextAlign = 'left') =>
    filmText(ctx, fonts, value, x, y, size, alpha, false, align);
  text(data.name, 72, 157, 20); text(data.period, 72, 181, 11, .6);
  text(`설비 자동 순회  ${index + 1} / ${data.equipment.length}`, 1208, 153, 16, 1, 'right');
  text(`다음: ${data.equipment[(index + 1) % data.equipment.length]?.name ?? '—'}`, 1208, 179, 12, .65, 'right');
  if (!result) { text(item ? '측정값 확인 필요 · OEE 산출 불가' : '설비 데이터 대기', 640, 350, 22, 1, 'center'); return; }
  const colors = ['#60dfed', '#f4bc73', '#95e0b1'];
  const values = [result.availability, result.performance, result.quality];
  const names = ['가동률', '성능', '품질'];
  ctx.save();
  // Three distinct instruments arrive at one common centre; the product is the OEE.
  values.forEach((value, k) => {
    const phase = smooth(k * .3, 1.5 + k * .3, age), radius = 106 + k * 17;
    const cx = 448 + (k - 1) * 210 * (1 - phase), cy = 351;
    ctx.lineWidth = 9; ctx.strokeStyle = 'rgba(145,202,217,.08)';
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = colors[k]; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * value * phase); ctx.stroke();
    const y = 251 + k * 81;
    ctx.fillStyle = colors[k]; ctx.fillRect(720, y - 13, 3, 39);
    text(names[k], 738, y, 15, .75);
    text(`${(value * 100).toFixed(1)}%`, 1130, y + 5, 29, 1, 'right');
    ctx.fillStyle = 'rgba(145,202,217,.08)'; ctx.fillRect(738, y + 19, 392, 3);
    ctx.fillStyle = colors[k]; ctx.fillRect(738, y + 19, 392 * value * phase, 3);
  });
  text(item.name, 448, 200, 20, 1, 'center');
  text('OEE', 448, 324, 17, .65, 'center');
  text(`${(result.oee * 100 * smooth(.8, 2.2, age)).toFixed(1)}%`, 448, 378, 49, 1, 'center');
  text('가동률 × 성능 × 품질', 448, 407, 12, .65, 'center');
  text('계획 시간 → 가치 생산 시간', 72, 540, 14, .85);
  let cursor = 72;
  [result.oee, ...result.losses].forEach((value, k) => {
    const w = 1136 * value;
    ctx.fillStyle = k === 0 ? signalColor(0, .75) : ['#dd965f', '#b98465', '#aa6773'][k - 1];
    ctx.fillRect(cursor, 555, w * reveal, 12); cursor += w;
  });
  text(`유효 생산 ${(result.oee * 100).toFixed(1)}%`, 72, 592, 13);
  result.losses.forEach((loss, k) => text(`${['정지', '속도', '불량'][k]} 손실 ${(loss * 100).toFixed(1)}%p`, 405 + k * 255, 592, 13, .75));
  const first = Math.max(0, Math.min(index - 2, data.equipment.length - 5)), visible = data.equipment.slice(first, first + 5);
  visible.forEach((machine, offset) => {
    const x = 72 + offset * 230, score = calculateOee(machine);
    ctx.fillStyle = signalColor(0, machine.id === item.id ? .13 : .025); ctx.fillRect(x, 622, 216, 52);
    if (machine.id === item.id) {
      ctx.strokeStyle = signalColor(0, .9); ctx.lineWidth = 1.5; ctx.strokeRect(x, 622, 216, 52);
      ctx.fillStyle = signalColor(0, .9); ctx.fillRect(x, 674, 216 * (t % segment) / segment, 3);
    }
    text(machine.name, x + 12, 644, 12, .7);
    text(score ? `${(score.oee * 100).toFixed(1)}%` : '—', x + 203, 660, 16, 1, 'right');
  });
  ctx.restore();
}
