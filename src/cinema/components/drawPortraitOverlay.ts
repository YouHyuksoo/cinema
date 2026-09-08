import { filmText, signalColor, type FilmFonts } from '../filmDrawing';
import { drawRotor } from './drawRotor';

/** Optical reflections overlap the temples; the centre stays open for the face. */
export function drawPortraitOverlay(ctx: CanvasRenderingContext2D, fonts: FilmFonts, time: number) {
  ctx.save();
  ctx.globalAlpha = .54;
  for (const side of [-1, 1]) {
    ctx.save(); ctx.translate(640 + side * 190, 169); ctx.transform(1, side * .12, 0, .82, 0, 0);
    drawRotor(ctx, { x: 0, y: 0, radius: 81, time, speed: side * .3, variant: 'segments', heat: side < 0 ? .75 : 0 });
    ctx.restore();
    ctx.save(); ctx.translate(640 + side * 222, 500); ctx.transform(1, -side * .26, 0, .86, 0, 0);
    drawRotor(ctx, { x: 0, y: 0, radius: 103, time, speed: -side * .24, variant: 'orbit' });
    ctx.restore();
  }
  ctx.restore();

  for (const side of [-1, 1]) {
    const x = side < 0 ? 477 : 711;
    const heat = side < 0 ? .65 : 0;
    // A faint reflected pane fades toward the cheek, without a boxed video boundary.
    const reflection = ctx.createLinearGradient(side < 0 ? x : x + 92, 0, side < 0 ? x + 92 : x, 0);
    reflection.addColorStop(0, signalColor(heat, .08)); reflection.addColorStop(1, signalColor(heat, 0));
    ctx.fillStyle = reflection; ctx.fillRect(x, 366, 92, 82);
    for (let index = 0; index < 4; index++) {
      const y = 376 + index * 17;
      ctx.strokeStyle = signalColor(heat, .18); ctx.lineWidth = .65;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 83, y); ctx.stroke();
      const length = 18 + (Math.sin(time * .65 + index * 1.7 + side) * .5 + .5) * 42;
      ctx.fillStyle = signalColor(heat, .32); ctx.fillRect(x, y + 5, length, 2);
    }
    filmText(ctx, fonts, side < 0 ? 'LINE / 03' : 'YIELD / 98.6', x, 359, 9, .48, true, 'left', signalColor(heat, 1));
  }
  ctx.beginPath(); ctx.arc(640, 205, 4, 0, Math.PI * 2);
  ctx.strokeStyle = signalColor(0, .42); ctx.lineWidth = .8; ctx.stroke();
  for (const side of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(640 + side * 8, 205); ctx.lineTo(640 + side * 14, 205); ctx.stroke();
  }
}
