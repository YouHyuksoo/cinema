import { drivenGear, mainGear } from './gearGeometry';
import { drawGear } from './components/drawGear';
import { filmText, signalColor, smooth, type FilmFonts } from './filmDrawing';
import { applyFocusProjection, focusEnvelope, focusProjection, projectFocusPoint } from './filmFocus';
export { DEFAULT_FONTS, filmText, signalColor, smooth, windowAt, type FilmFonts } from './filmDrawing';

import { FILM_DURATIONS } from './filmProgram';
export const GEAR_FILM_SECONDS = FILM_DURATIONS.gears;
const INK = '#d7edf0';

export function gearFocusAt(time: number) {
  const focus = focusEnvelope(time, { enter: [8, 12], exit: [20, 23] });
  return { focus, projection: focusProjection({ x: 620, y: 352, focus, depth: 150, lift: 14 }) };
}

function leader(ctx: CanvasRenderingContext2D, points: number[][], reveal: number, heat: number) {
  if (reveal <= 0) return;
  const lengths = points.slice(1).map((p, i) => Math.hypot(p[0] - points[i][0], p[1] - points[i][1]));
  let remaining = lengths.reduce((a, b) => a + b, 0) * reveal;
  ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 0; i < lengths.length; i++) {
    const progress = Math.min(1, remaining / lengths[i]);
    ctx.lineTo(points[i][0] + (points[i + 1][0] - points[i][0]) * progress,
      points[i][1] + (points[i + 1][1] - points[i][1]) * progress);
    remaining -= lengths[i]; if (remaining <= 0) break;
  }
  ctx.strokeStyle = signalColor(heat, reveal * .55); ctx.lineWidth = .8; ctx.stroke();
}

export function drawGearTrain(ctx: CanvasRenderingContext2D, t: number, fonts: FilmFonts) {
  const release = 1 - smooth(23, 26, t);
  const heat = smooth(11, 15, t) * (1 - smooth(20, 24, t));
  const main = mainGear(t * .16);
  const output = drivenGear(main, 32, -2.55);
  const quality = drivenGear(main, 36, .58);
  const gears = [main, output, quality];
  const { focus, projection } = gearFocusAt(t);
  const reveals = [smooth(5, 8, t), smooth(7, 10, t), smooth(9, 12, t)].map(v => v * release);
  // Coupled gears travel in the same depth plane so their pitch contacts stay engaged.
  ctx.save(); applyFocusProjection(ctx, projection);
  gears.forEach((g, i) => drawGear(ctx, g, reveals[i], i === 0 ? heat : i === 2 ? heat * .65 : 0, i === 0, 11 * focus));

  // Light crosses the shared pitch contacts in time with tooth engagement.
  for (const [i, bearing] of [-2.55, .58].entries()) {
    const pulse = (.5 + .5 * Math.cos((main.angle - bearing) * main.teeth)) * reveals[i + 1];
    const x = main.x + Math.cos(bearing) * main.radius, y = main.y + Math.sin(bearing) * main.radius;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, 19);
    glow.addColorStop(0, signalColor(heat, pulse * .45)); glow.addColorStop(1, signalColor(heat, 0));
    ctx.fillStyle = glow; ctx.fillRect(x - 19, y - 19, 38, 38);
  }

  const text = (value: string, x: number, y: number, size: number, opacity: number, mono = false, align: CanvasTextAlign = 'left', color = INK) =>
    filmText(ctx, fonts, value, x, y, size, opacity, mono, align, color);
  const thermalRead = smooth(8, 10, t) * release;
  text('SMT / 03', main.x, main.y - 43, 13, thermalRead * .7, true, 'center');
  text((78.2 + 16.4 * heat).toFixed(1) + '°', main.x, main.y + 14, 55, thermalRead, true, 'center');
  text('공정 온도', main.x, main.y + 43, 13, thermalRead * .65, false, 'center');
  text(heat > .5 ? 'THERMAL DRIFT' : 'MONITORING', main.x, main.y + 63, 10, thermalRead * .7, true, 'center', signalColor(heat, 1));

  const outputRead = smooth(10, 12, t) * release;
  text('PRODUCTION', output.x, output.y - 25, 10, outputRead * .6, true, 'center');
  text(Math.round(1248 + (t - 10) * 2.4).toLocaleString('en-US'), output.x, output.y + 13, 33, outputRead, true, 'center');
  text('생산 수량 / EA', output.x, output.y + 36, 11, outputRead * .65, false, 'center');

  const qualityRead = smooth(12, 14, t) * release;
  text('YIELD', quality.x, quality.y - 29, 11, qualityRead * .65, true, 'center');
  text((99.2 - heat * 2.8).toFixed(1) + '%', quality.x, quality.y + 14, 34, qualityRead, true, 'center');
  text('양품률', quality.x, quality.y + 39, 12, qualityRead * .65, false, 'center');
  ctx.restore();

  const analysis = smooth(14, 16, t) * (1 - smooth(21, 23, t));
  const thermalAnchor = projectFocusPoint(projection, { x: 738, y: 265 });
  leader(ctx, [[thermalAnchor.x, thermalAnchor.y], [813, 208], [1130, 208]], analysis, heat);
  const analysisText = smooth(15, 17, t) * (1 - smooth(21, 23, t));
  text('01 / CORRELATION FOUND', 833, 189, 11, analysisText * .75, true, 'left', signalColor(heat, 1));
  text('온도 +16.4°C  /  양품률 −2.8%p', 833, 280, 15, analysisText * .8);
  text('냉각 계통 확인을 권장합니다.', 833, 309, 14, analysisText * .55);

  const production = smooth(11, 13, t) * (1 - smooth(21, 23, t));
  const outputAnchor = projectFocusPoint(projection, { x: 345, y: 260 });
  leader(ctx, [[outputAnchor.x, outputAnchor.y], [274, 316], [118, 316]], production, 0);
  text('LINE 01 / RUNNING', 118, 344, 11, production * .7, true);
  text('생산 흐름 유지 중', 118, 369, 16, production * .8);
}
