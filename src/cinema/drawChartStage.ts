import { drawInspectionRoom } from './components/drawInspectionRoom';
import { inspectionCamera } from './inspectionSpace';
import { filmText, signalColor, smooth, type FilmFonts } from './filmDrawing';
import { beginFilmViewport, fillFilmViewport, type FilmViewportInsets } from './filmViewport';

/** A restrained spatial stage keeps the charts in the same cinematic environment. */
export function drawChartStage(ctx: CanvasRenderingContext2D, width: number, height: number,
  time: number, fonts: FilmFonts, name: string, insets?: FilmViewportInsets) {
  const view = beginFilmViewport(ctx, width, height, insets);
  ctx.fillStyle = '#040b10'; fillFilmViewport(ctx, view);
  ctx.save(); ctx.globalAlpha = .22;
  drawInspectionRoom(ctx, fonts, inspectionCamera(time * .22, .1), time);
  ctx.restore();
  const lightRadius = Math.max(760, Math.hypot(
    Math.max(Math.abs(view.left - 580), Math.abs(view.right - 580)),
    Math.max(Math.abs(view.top - 356), Math.abs(view.bottom - 356)),
  ));
  const light = ctx.createRadialGradient(580, 356, 50, 580, 356, lightRadius);
  light.addColorStop(0, 'rgba(4,14,20,.4)'); light.addColorStop(.65, 'rgba(4,11,16,.7)'); light.addColorStop(1, '#040b10');
  ctx.fillStyle = light; fillFilmViewport(ctx, view);
  const reveal = smooth(.2, 2, time);
  ctx.beginPath(); ctx.moveTo(72, 121); ctx.lineTo(72 + 1136 * reveal, 121);
  ctx.strokeStyle = signalColor(0, .14); ctx.lineWidth = .8; ctx.stroke();
  for (let pulse = 0; pulse < 4; pulse++) {
    const x = 72 + ((time * 54 + pulse * 310) % 1136);
    ctx.fillStyle = signalColor(0, .25 * reveal); ctx.fillRect(x, 120, 9, 1.4);
  }
  filmText(ctx, fonts, 'DATA / MOTION STUDIES', 72, 76, 14, .65, true);
  filmText(ctx, fonts, name, 72, 99, 10, .38, true);
}
