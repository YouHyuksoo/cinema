import { filmText, signalColor, smooth, type FilmFonts } from '../filmDrawing';

/** Stateless reticle follows the selected cabinet in the same camera coordinate system. */
export function drawMounterLockOn(ctx: CanvasRenderingContext2D, fonts: FilmFonts,
  x: number, distance: number, time: number, opacity: number, station = 0) {
  const age = Math.max(0, time - (station === 0 ? .35 : station * 5 - .825));
  const capture = smooth(0, .85, age);
  const acquired = (1 - smooth(.015, .4, distance)) * capture;
  const locked = distance < .035 && capture > .98;
  const burst = smooth(.7, .87, age) * (1 - smooth(.87, 1.5, age));
  const spread = 64 * (1 - acquired);
  const left = x - 160 - spread, right = x + 183 + spread;
  const top = 163 - spread * .3, bottom = 488 + spread * .3;
  ctx.save(); ctx.globalAlpha = opacity * (.6 + acquired * .4);
  // Short acquisition rings and radial strokes converge once per selected station.
  ctx.save(); ctx.translate(x + 11.5, 325.5);
  const energy = 1 - smooth(.85, 1.55, age);
  ctx.globalAlpha *= energy;
  ctx.rotate((1 - capture) * 1.25);
  for (let ring = 0; ring < 2; ring++) {
    const radius = 185 + ring * 18 + (1 - capture) * 65;
    ctx.strokeStyle = signalColor(0, ring ? .4 : .85); ctx.lineWidth = ring ? 1 : 2;
    for (let sector = 0; sector < 4; sector++) {
      const angle = sector * Math.PI / 2 + ring * .2;
      ctx.beginPath(); ctx.arc(0, 0, radius, angle, angle + .65); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(Math.cos(angle) * (radius - 12), Math.sin(angle) * (radius - 12));
      ctx.lineTo(Math.cos(angle) * (radius + 10), Math.sin(angle) * (radius + 10)); ctx.stroke();
    }
  }
  ctx.restore();
  if (burst > .001) {
    ctx.save(); ctx.globalAlpha *= burst;
    ctx.strokeStyle = signalColor(0, .85); ctx.lineWidth = 2;
    const expansion = Math.max(0, age - .85) * 75;
    ctx.strokeRect(left - expansion, top - expansion * .5, right - left + expansion * 2, bottom - top + expansion);
    for (let ray = 0; ray < 12; ray++) {
      const angle = ray * Math.PI / 6;
      const radius = 190 + expansion;
      ctx.beginPath(); ctx.moveTo(x + 11.5 + Math.cos(angle) * radius, 325.5 + Math.sin(angle) * radius * .86);
      ctx.lineTo(x + 11.5 + Math.cos(angle) * (radius + 15), 325.5 + Math.sin(angle) * (radius + 15) * .86); ctx.stroke();
    }
    ctx.restore();
  }
  ctx.strokeStyle = signalColor(0, .9); ctx.lineWidth = 2; ctx.setLineDash([]);
  for (const [xx, yy, dx, dy] of [[left, top, 1, 1], [right, top, -1, 1],
    [left, bottom, 1, -1], [right, bottom, -1, -1]]) {
    ctx.save(); ctx.translate(xx, yy); ctx.rotate(dx * dy * (1 - capture) * .5); ctx.translate(-xx, -yy);
    ctx.beginPath(); ctx.moveTo(xx, yy + dy * 24); ctx.lineTo(xx, yy);
    ctx.lineTo(xx + dx * 32, yy); ctx.stroke();
    ctx.fillStyle = signalColor(0, .7 + burst * .3); ctx.fillRect(xx - 2, yy - 2, 4, 4);
    ctx.restore();
  }
  // A narrow transparent sweep, rather than tinting or obscuring the cabinet.
  const scan = top + 16 + ((Math.max(0, time) % 3.2) / 3.2) * (bottom - top - 32);
  const beam = ctx.createLinearGradient(0, scan - 16, 0, scan);
  beam.addColorStop(0, signalColor(0, 0)); beam.addColorStop(1, signalColor(0, .12));
  ctx.fillStyle = beam; ctx.fillRect(left + 8, scan - 16, right - left - 16, 16);
  ctx.strokeStyle = signalColor(0, .38); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(left + 8, scan); ctx.lineTo(right - 8, scan); ctx.stroke();
  filmText(ctx, fonts, locked ? 'LOCKED · 분석 중' : 'ACQUIRING · 추적 중',
    x, top - 10, 11, opacity, true, 'center', signalColor(0, 1));
  ctx.restore();
}
