import { DEFAULT_FONTS, drawGearTrain, gearFocusAt, GEAR_FILM_SECONDS as FILM_SECONDS, filmText, signalColor, smooth, type FilmFonts } from './drawGearTrain';
import { TAU } from './gearGeometry';
import { applyFocusProjection } from './filmFocus';
import { beginFilmViewport, fillFilmViewport, type FilmViewportInsets } from './filmViewport';

/** One continuous field, deformed by one timeline. Labels grow out of its geometry. */
export function drawGearFilm(ctx: CanvasRenderingContext2D, width: number, height: number, t: number, fonts: FilmFonts = DEFAULT_FONTS, insets?: FilmViewportInsets) {
  const view = beginFilmViewport(ctx, width, height, insets);
  ctx.fillStyle = '#040b10'; fillFilmViewport(ctx, view);
  const gather = smooth(2, 6, t) * (1 - smooth(24, 28, t));
  const mechanism = smooth(5, 8, t) * (1 - smooth(23, 26, t));
  const heat = smooth(11, 15, t) * (1 - smooth(20, 24, t));
  const cx = 620, cy = 352;
  const color = (opacity: number) => signalColor(heat, opacity);
  const wash = ctx.createRadialGradient(cx, cy, 0, cx, cy, 540);
  wash.addColorStop(0, color(.04 + gather * .015)); wash.addColorStop(1, 'rgba(4,11,16,0)');
  ctx.fillStyle = wash; fillFilmViewport(ctx, view);

  // A faint field of moving traces shares the foreground's attraction point.
  const fieldWidth = view.right - view.left + 120, fieldHeight = view.bottom - view.top;
  const particles = Math.min(300, Math.ceil(90 * fieldWidth * fieldHeight / (1400 * 720)));
  for (let i = 0; i < particles; i++) {
    const phase = (i * .618033 + t / FILM_SECONDS) % 1;
    const x = view.left - 60 + phase * fieldWidth;
    const y = view.top + fieldHeight * (.5 + Math.sin(i * 31.7) * .48);
    const pull = Math.exp(-Math.pow((x - cx) / 270, 2)) * gather;
    ctx.strokeStyle = color(.055 + (i % 4) * .018); ctx.lineWidth = .7;
    ctx.beginPath(); ctx.moveTo(x, y + (cy - y) * pull * .3); ctx.lineTo(x + 3 + gather * 10, y + (cy - y) * pull * .3); ctx.stroke();
  }

  const point = (u: number, strand: number): [number, number] => {
    const envelope = Math.pow(Math.sin(Math.PI * u), 2);
    const x = 80 + u * 1120;
    const wave = Math.sin(u * TAU * 2 + t * TAU / FILM_SECONDS * 3 + strand * .09) * 30 * envelope;
    const baseY = cy + (strand - 17) * 3.3 * envelope + wave;
    const angle = u * TAU + t * .16;
    const radius = 144 + (strand - 17) * (2.8 - 2.1 * mechanism);
    const orbitX = cx + Math.cos(angle) * radius;
    const orbitY = cy + Math.sin(angle) * radius;
    return [x * (1 - gather) + orbitX * gather, baseY * (1 - gather) + orbitY * gather];
  };
  ctx.save();
  applyFocusProjection(ctx, gearFocusAt(t).projection);
  ctx.globalCompositeOperation = 'lighter';
  for (let strand = 0; strand < 35; strand++) {
    ctx.beginPath();
    for (let j = 0; j <= 220; j++) {
      const [x, y] = point(j / 220, strand);
      if (j === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = color((strand % 7 === 0 ? .46 : .10) * (1 - mechanism * .97)); ctx.lineWidth = strand % 7 === 0 ? 1.25 : .65; ctx.stroke();
  }
  for (let i = 0; i < 12; i++) {
    const u = (t / FILM_SECONDS * 2 + i / 12) % 1;
    const [x, y] = point(u, (i * 7) % 35);
    ctx.beginPath(); ctx.arc(x, y, 1.3, 0, TAU); ctx.fillStyle = color(.8 * (1 - mechanism)); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();

  drawGearTrain(ctx, t, fonts);
  const text = (value: string, x: number, y: number, size: number, opacity: number, mono = false, align: CanvasTextAlign = 'left') =>
    filmText(ctx, fonts, value, x, y, size, opacity, mono, align);
  text('J / 03', 72, 76, 14, .6, true);
  text('COUPLED SIGNALS', 72, 99, 10, .4, true);
  text('SIGNAL FILM / SIMULATED', 1208, 689, 10, .4, true, 'right');
}
