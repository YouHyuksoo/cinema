import { DEFAULT_FONTS, filmText, signalColor, smooth, windowAt, type FilmFonts } from './drawGearTrain';
import { applyFocusProjection, focusEnvelope, focusProjection, projectFocusPoint } from './filmFocus';
import { beginFilmViewport, fillFilmViewport, type FilmViewportInsets } from './filmViewport';

import { FILM_DURATIONS } from './filmProgram';
export const SCAN_FILM_SECONDS = FILM_DURATIONS.scan;

type Point = readonly [number, number];
const TAU = Math.PI * 2;
const FOCUS_X = 456;
const EQUIPMENT = [
  ['LOAD 01', 124], ['SPI 01', 208], ['SMT 01', 290], ['SMT 02', 374],
  ['SMT 03', FOCUS_X], ['REFLOW', 546], ['AOI 01', 634], ['AOI 02', 722],
  ['TEST 01', 816], ['TEST 02', 902], ['PACK 01', 996], ['OUT 01', 1132],
] as const;

const mix = (a: number, b: number, blend: number) => a + (b - a) * blend;
const contour = (x: number) => 376 + Math.sin((x - 110) / 150) * 61 + Math.sin(x / 64) * 16;
const FOCUS_Y = contour(FOCUS_X);

function trace(ctx: CanvasRenderingContext2D, points: readonly Point[], reveal: number, heat: number, opacity = .7) {
  if (reveal <= 0) return;
  const lengths = points.slice(1).map((p, i) => Math.hypot(p[0] - points[i][0], p[1] - points[i][1]));
  let remaining = lengths.reduce((sum, length) => sum + length, 0) * Math.min(1, reveal);
  ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 0; i < lengths.length; i++) {
    const progress = Math.min(1, remaining / Math.max(lengths[i], .001));
    ctx.lineTo(mix(points[i][0], points[i + 1][0], progress), mix(points[i][1], points[i + 1][1], progress));
    remaining -= lengths[i];
    if (remaining <= 0) break;
  }
  ctx.strokeStyle = signalColor(heat, opacity); ctx.lineWidth = .85; ctx.stroke();
}

/** A scanning plane resolves one continuous equipment contour into an annotated thermal trace. */
export function drawScanFilm(ctx: CanvasRenderingContext2D, width: number, height: number, t: number, fonts: FilmFonts = DEFAULT_FONTS, insets?: FilmViewportInsets) {
  const view = beginFilmViewport(ctx, width, height, insets);
  ctx.fillStyle = '#040b10'; fillFilmViewport(ctx, view);
  const shape = smooth(1.2, 4, t) * (1 - smooth(19, 22, t));
  const focus = smooth(9, 12, t) * (1 - smooth(18.5, 21, t));
  const approach = focusEnvelope(t, { enter: [8.8, 12.2], exit: [18, 20.8] });
  const projection = focusProjection({ x: FOCUS_X, y: FOCUS_Y, focus: approach, depth: 360, lift: 30 });
  const front = projectFocusPoint(projection, { x: FOCUS_X, y: FOCUS_Y });
  const readoutProjection = focusProjection({ x: 940, y: 370, focus: approach, depth: 75, lift: 8 });
  const readout = smooth(13.7, 15.3, t) * (1 - smooth(18, 20, t));
  const scan = smooth(3, 9, t);
  const sweepX = 72 + scan * 1136;
  const sweepVisible = smooth(2.5, 3.5, t) * (1 - smooth(18.5, 21, t));
  const caught = smooth(5.2, 6.3, t) * (1 - smooth(18.5, 21, t));
  const text = (value: string, x: number, y: number, size: number, opacity: number, mono = false, color = '#d7edf0') =>
    filmText(ctx, fonts, value, x, y, size, opacity, mono, 'left', color);

  const wash = ctx.createRadialGradient(FOCUS_X, FOCUS_Y, 0, FOCUS_X, FOCUS_Y, 340);
  wash.addColorStop(0, signalColor(focus, .025 + focus * .02)); wash.addColorStop(1, signalColor(0, 0));
  ctx.fillStyle = wash; fillFilmViewport(ctx, view);

  // Every strand begins and ends as the same ribbon used by the other films.
  // The narrow wave field spreads into equipment contours as the scan crosses it.
  ctx.save(); ctx.beginPath(); ctx.rect(72, 110, 1136, 520); ctx.clip();
  for (let strand = 0; strand < 23; strand++) {
    ctx.beginPath();
    for (let sample = 0; sample <= 190; sample++) {
      const u = sample / 190, x = 72 + u * 1136;
      const envelope = Math.sin(Math.PI * u);
      const freeY = 376 + Math.sin(u * TAU * 2 + t * .4 + strand * .08) * 22 * envelope + (strand - 11) * 2.1 * envelope;
      const scanned = smooth(x - 100, x + 40, sweepX);
      const pull = Math.exp(-Math.pow((x - FOCUS_X) / 190, 2));
      const contourY = contour(x) + (strand - 11) * (2.5 + focus * pull * 1.8)
        + Math.sin(x / 31 + strand * .12 + t * .2) * 3;
      const y = mix(freeY, contourY, shape * (.35 + scanned * .65));
      if (sample === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    const main = strand === 11 || strand === 4 || strand === 18;
    ctx.strokeStyle = signalColor(0, (main ? .28 : .072) * (1 - focus * .45));
    ctx.lineWidth = main ? 1 : .65; ctx.stroke();
  }

  // A translucent fan follows the scanning plane, without changing the whole frame's luminance.
  const scanFan = sweepVisible * (1 - smooth(9, 11.7, t));
  if (scanFan > .001) {
    const fan = ctx.createLinearGradient(sweepX - 118, 0, sweepX, 0);
    fan.addColorStop(0, signalColor(0, 0)); fan.addColorStop(.8, signalColor(0, .025 * scanFan));
    fan.addColorStop(1, signalColor(0, .085 * scanFan)); ctx.fillStyle = fan;
    ctx.beginPath(); ctx.moveTo(sweepX - 104, 160); ctx.lineTo(sweepX, 126);
    ctx.lineTo(sweepX, 604); ctx.lineTo(sweepX - 118, 558); ctx.closePath(); ctx.fill();
    for (let i = 1; i <= 5; i++) {
      trace(ctx, [[sweepX - i * 13, 148 + i * 8], [sweepX - i * 13, 596 - i * 7]], 1, 0, .08 * scanFan);
    }
  }

  EQUIPMENT.forEach(([name, x], index) => {
    const detected = smooth(x - 20, x + 80, sweepX) * shape;
    if (detected <= .001) return;
    const isFocus = index === 4;
    const heat = isFocus ? caught : 0;
    const opacity = detected * (isFocus ? 1 : 1 - focus * .67);
    const y = contour(x), lift = index % 2 === 0 ? -1 : 1;
    const stemY = y + lift * (35 + index % 3 * 5);
    if (isFocus && approach > .001) {
      ctx.beginPath(); ctx.ellipse(x, y + 13, 25 + approach * 10, 5 + approach * 2, 0, 0, TAU);
      ctx.fillStyle = signalColor(heat, approach * .035); ctx.fill();
      trace(ctx, [[x - 15, y + 5], [x - 15, y - 17], [x + 9, y - 17], [x + 9, y + 5]], 1, 0, approach * .15);
      for (const edgeX of [x - 15, x + 9]) {
        const projected = projectFocusPoint(projection, { x: edgeX, y: y + 5 });
        trace(ctx, [[edgeX, y + 5], [projected.x, projected.y]], 1, heat, approach * .2);
      }
    }
    ctx.save();
    if (isFocus) applyFocusProjection(ctx, projection);
    // Small machined marks remain attached to the contour; there are no enclosed equipment tiles.
    trace(ctx, [[x - 15, y + 5], [x - 15, y - 8], [x - 7, y - 8], [x - 7, y - 17], [x + 9, y - 17], [x + 9, y + 5], [x + 17, y + 5]], 1, heat, opacity * .64);
    trace(ctx, [[x, y + 8], [x, stemY], [x + 12, stemY]], 1, heat, opacity * .4);
    ctx.fillStyle = signalColor(heat, opacity * .9); ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    if (!isFocus || focus < .6) text(name, x - 22, stemY + (lift < 0 ? -7 : 17), 10, opacity * (isFocus ? 1 - focus : .6), true, signalColor(heat, 1));
    for (let tick = 0; tick < 3; tick++) {
      trace(ctx, [[x - 10 + tick * 7, y + 15], [x - 10 + tick * 7, y + 20 + (tick % 2) * 3]], 1, heat, opacity * .45);
    }
    ctx.restore();
  });

  // The two halves of the scanning plane bend into open focus brackets.
  // This is the scanner's original geometry, not a separate overlay appearing on top.
  const lock = smooth(9, 12, t);
  const bracketPaths: readonly (readonly Point[])[] = [
    [[FOCUS_X - 30, FOCUS_Y - 62], [FOCUS_X - 56, FOCUS_Y - 62], [FOCUS_X - 56, FOCUS_Y - 30]],
    [[FOCUS_X + 56, FOCUS_Y + 30], [FOCUS_X + 56, FOCUS_Y + 62], [FOCUS_X + 30, FOCUS_Y + 62]],
  ];
  const sweepPaths: readonly (readonly Point[])[] = [
    [[sweepX, 132], [sweepX, 250], [sweepX, 365]],
    [[sweepX, 365], [sweepX, 484], [sweepX, 604]],
  ];
  bracketPaths.forEach((path, index) => {
    const morphed: Point[] = path.map((p, i) => {
      const projected = projectFocusPoint(projection, { x: p[0], y: p[1] });
      return [mix(sweepPaths[index][i][0], projected.x, lock), mix(sweepPaths[index][i][1], projected.y, lock)];
    });
    trace(ctx, morphed, 1, lock * caught, sweepVisible * .8);
  });

  // Neighbouring traces converge on the warm equipment and continue as its annotation leader.
  for (let strand = 0; strand < 7; strand++) {
    const spread = (strand - 3) * 8;
    ctx.beginPath(); ctx.moveTo(216, contour(216) + spread);
    ctx.bezierCurveTo(296, contour(296) + spread, front.x - 78, front.y + spread * .3, front.x, front.y);
    ctx.bezierCurveTo(front.x + 90, front.y, 607, 246 + spread * .5, 710, 246 + spread * .2);
    ctx.strokeStyle = signalColor(1, focus * (strand === 3 ? .7 : .065));
    ctx.lineWidth = strand === 3 ? 1.2 : .7; ctx.stroke();
  }
  const leaderTop = projectFocusPoint(readoutProjection, { x: 658, y: 238 });
  const leaderEnd = projectFocusPoint(readoutProjection, { x: 1134, y: 238 });
  const historyStart = projectFocusPoint(readoutProjection, { x: 674, y: 501 });
  trace(ctx, [[front.x, front.y], [582, 306], [leaderTop.x, leaderTop.y], [leaderEnd.x, leaderEnd.y]], smooth(10.7, 13.7, t), 1, focus * .62);
  trace(ctx, [[front.x, front.y + 19 * projection.scale], [566, historyStart.y], [historyStart.x, historyStart.y]], smooth(12, 14, t), 1, focus * .34);
  ctx.save(); applyFocusProjection(ctx, projection);
  text('SMT 03', FOCUS_X - 38, FOCUS_Y - 82, 22, focus, true, signalColor(1, 1));
  text('온도 이탈 감지', FOCUS_X - 40, FOCUS_Y + 89, 13, focus * .85, false, signalColor(1, 1));
  ctx.restore();

  // The tiny history is part of the outgoing equipment trace, beneath the same readout.
  const history: Point[] = [[674, 501]];
  for (let sample = 0; sample <= 70; sample++) {
    const u = sample / 70;
    history.push([674 + u * 440, 501 - (Math.sin(u * 19) * 2 + smooth(.33, .86, u) * 33)]);
  }
  ctx.save(); applyFocusProjection(ctx, readoutProjection);
  trace(ctx, history, smooth(14.5, 17, t), 1, readout * .64);
  ctx.restore();
  ctx.restore();

  text('J / 03', 72, 76, 14, .6, true);
  text('EQUIPMENT SCAN', 72, 99, 10, .4, true);
  text('12개 설비', 728, 221, 13, windowAt(.5, 5, t) * .55);
  ctx.save(); applyFocusProjection(ctx, readoutProjection);
  text('THERMAL TRACE / SMT 03', 730, 216, 11, readout * .75, true, signalColor(1, 1));
  text('공정 온도', 730, 280, 16, readout * .75);
  text('94.6°C', 726, 351, 64, readout, true, signalColor(1, 1));
  text('기준 78.2°C 대비', 730, 391, 14, readout * .62);
  text('+16.4°C', 937, 391, 22, readout, true, signalColor(1, 1));
  text('열 변화가 지속됩니다. 냉각 계통을 확인하세요.', 730, 430, 14, readout * .83);
  text('직전 60초 / 온도 변화', 731, 531, 11, readout * .5);
  ctx.restore();
}
