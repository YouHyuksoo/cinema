import { signalColor, smooth, type FilmFonts } from '../filmDrawing';
import { RADAR_SCAN_START, radarPolarPoint, type RadarSignalData, type RadarSignalState } from '../radarSignal';

const TAU = Math.PI * 2;

/** A fixed range instrument; only its clockwise search beam turns. */
export function drawRadarScope(ctx: CanvasRenderingContext2D, fonts: FilmFonts,
  data: RadarSignalData, state: RadarSignalState): { x: number; y: number } | undefined {
  const { project } = state;
  const target = state.target ? project(state.target.point) : undefined;
  const opacity = ctx.globalAlpha * state.reveal;
  if (opacity <= .001) return target;
  const center = project({ x: 0, y: 0, z: 0 });
  const ringPoint = (ratio: number, bearing: number, z = 0) => project(radarPolarPoint(ratio, bearing, z));
  const ringPath = (ratio: number, z = 0, from = 0, to = 360) => {
    const segments = Math.max(2, Math.ceil(Math.abs(to - from) / 3));
    ctx.beginPath();
    for (let index = 0; index <= segments; index++) {
      const point = ringPoint(ratio, from + (to - from) * index / segments, z);
      if (index) ctx.lineTo(point.x, point.y); else ctx.moveTo(point.x, point.y);
    }
  };
  const label = (value: string, x: number, y: number, size: number, alpha: number,
    heat = 0, align: CanvasTextAlign = 'left', maxWidth = 110) => {
    ctx.save(); ctx.font = `${size}px ${fonts.mono}`; ctx.textAlign = align;
    ctx.globalAlpha = opacity * alpha; ctx.fillStyle = signalColor(heat, 1);
    ctx.fillText(value, x, y, maxWidth); ctx.restore();
  };

  ctx.save(); ctx.globalAlpha = opacity;
  ctx.lineCap = 'butt'; ctx.lineJoin = 'round'; ctx.setLineDash([]); ctx.shadowBlur = 0;

  // The shallow rear rim and glass side walls give the entire instrument a shared thickness.
  ringPath(1, 22); ctx.strokeStyle = signalColor(0, .2); ctx.lineWidth = 1.2; ctx.stroke();
  for (let bearing = 0; bearing < 360; bearing += 6) {
    const points = [ringPoint(1, bearing), ringPoint(1, bearing + 6),
      ringPoint(1, bearing + 6, 22), ringPoint(1, bearing, 22)];
    ctx.beginPath(); points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
    ctx.closePath(); ctx.fillStyle = signalColor(0, .024 + Math.max(0, Math.cos(bearing * Math.PI / 180)) * .044); ctx.fill();
  }
  ringPath(1); ctx.closePath();
  const glass = ctx.createRadialGradient(center.x - 65, center.y - 80, 12, center.x, center.y, 280);
  glass.addColorStop(0, signalColor(0, .014)); glass.addColorStop(.72, signalColor(0, .007));
  glass.addColorStop(1, signalColor(0, .035)); ctx.fillStyle = glass; ctx.fill();

  // Three physical range rings and four quiet cardinal spokes stay fixed during the sweep.
  for (const ratio of [1 / 3, 2 / 3, 1]) {
    ringPath(ratio); ctx.strokeStyle = signalColor(0, ratio === 1 ? .42 : .2);
    ctx.lineWidth = ratio === 1 ? 1.25 : .8; ctx.stroke();
    if (Number.isFinite(data.rangeKm) && data.rangeKm > 0) {
      const p = ringPoint(ratio, 176);
      label(`${(data.rangeKm * ratio).toLocaleString('en-US', { maximumFractionDigits: 1 })} km`,
        p.x + 8, p.y - 5, 9, .5);
    }
  }
  for (const bearing of [0, 90, 180, 270]) {
    const from = ringPoint(.04, bearing), to = ringPoint(.962, bearing);
    ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y);
    ctx.strokeStyle = signalColor(0, .13); ctx.lineWidth = .75; ctx.stroke();
  }

  // Bearing ticks do not rotate with the beam, so north and the contact bearings remain readable.
  for (let bearing = 0; bearing < 360; bearing += 3) {
    const major = bearing % 30 === 0, medium = bearing % 15 === 0;
    const from = ringPoint(major ? .936 : medium ? .953 : .972, bearing);
    const to = ringPoint(.988, bearing);
    ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y);
    ctx.strokeStyle = signalColor(0, major ? .65 : medium ? .32 : .16);
    ctx.lineWidth = major ? 1.2 : .7; ctx.stroke();
    if (major && bearing % 90 !== 0) {
      const p = ringPoint(1.045, bearing);
      label(String(bearing).padStart(3, '0'), p.x, p.y + 3, 8, .45, 0, 'center', 35);
    }
  }
  for (const [index, name] of ['N', 'E', 'S', 'W'].entries()) {
    const bearing = index * 90, p = ringPoint(1, bearing);
    const dx = index === 1 ? 17 : index === 3 ? -17 : 0;
    const dy = index === 0 ? -8 : index === 2 ? 10 : 4;
    label(name, p.x + dx, p.y + dy, 12, index === 0 ? .94 : .7, 0, 'center', 20);
  }

  const sweepOpacity = smooth(RADAR_SCAN_START, RADAR_SCAN_START + .4, state.elapsed);
  if (sweepOpacity > 0) {
    ctx.save(); ctx.globalAlpha *= sweepOpacity;
    // The triangular slices trail the head counterclockwise; increasing bearing advances clockwise.
    for (let slice = 0; slice < 24; slice++) {
      const start = state.scanBearing - 48 + slice * 2;
      const a = ringPoint(.986, start), b = ringPoint(.986, start + 2);
      ctx.beginPath(); ctx.moveTo(center.x, center.y); ctx.lineTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.closePath();
      ctx.fillStyle = signalColor(0, .004 + Math.pow((slice + 1) / 24, 2.2) * .09); ctx.fill();
    }
    const head = ringPoint(.99, state.scanBearing);
    ctx.beginPath(); ctx.moveTo(center.x, center.y); ctx.lineTo(head.x, head.y);
    ctx.strokeStyle = signalColor(0, .2); ctx.lineWidth = 5; ctx.stroke();
    ctx.strokeStyle = signalColor(0, .9); ctx.lineWidth = 1.4;
    ctx.shadowColor = signalColor(0, .65); ctx.shadowBlur = 9; ctx.stroke(); ctx.shadowBlur = 0;
    ringPath(.994, 0, state.scanBearing - 5, state.scanBearing + .7);
    ctx.strokeStyle = signalColor(0, .95); ctx.lineWidth = 2.8; ctx.stroke();
    ctx.restore();
  }

  // These lights exist only for supplied contacts after their first physical sweep crossing.
  for (const contact of state.contacts) {
    if (!contact.detected) continue;
    const base = project(contact.base), point = project(contact.point);
    const heat = contact.selected ? 1 : 0;
    const brightness = contact.echo * (.5 + contact.contact.strength * .5);
    ctx.save(); ctx.globalAlpha *= .35 + brightness * .65;
    const halo = ctx.createRadialGradient(base.x, base.y, 0, base.x, base.y, 17 + contact.contact.strength * 7);
    halo.addColorStop(0, signalColor(heat, .32)); halo.addColorStop(.4, signalColor(heat, .08));
    halo.addColorStop(1, signalColor(heat, 0)); ctx.fillStyle = halo;
    ctx.fillRect(base.x - 25, base.y - 25, 50, 50);
    ctx.beginPath(); ctx.arc(base.x, base.y, 2.1 + contact.contact.strength * 1.4, 0, TAU);
    ctx.fillStyle = signalColor(heat, contact.focus > 0 ? .35 : .95); ctx.fill();
    if (contact.age < 1.5) {
      ctx.beginPath(); ctx.arc(base.x, base.y, 5 + contact.age * 9, 0, TAU);
      ctx.strokeStyle = signalColor(heat, (1 - contact.age / 1.5) * .5); ctx.lineWidth = 1; ctx.stroke();
    }
    ctx.restore();

    if (contact.focus > .001) {
      ctx.save(); ctx.globalAlpha *= contact.focus;
      ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(point.x, point.y);
      ctx.setLineDash([3, 4]); ctx.strokeStyle = signalColor(heat, .48); ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(base.x, base.y, 7, 0, TAU);
      ctx.strokeStyle = signalColor(heat, .48); ctx.stroke();
      const pulse = .5 + .5 * Math.sin(state.elapsed * 3.3), half = (12 + contact.focus * 5 + pulse * 1.2) * point.scale;
      const length = 6 * point.scale;
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
        const x = point.x + sx * half, y = point.y + sy * half;
        ctx.beginPath(); ctx.moveTo(x - sx * length, y); ctx.lineTo(x, y); ctx.lineTo(x, y - sy * length);
        ctx.strokeStyle = signalColor(heat, .7 + pulse * .25); ctx.lineWidth = 1.6; ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(point.x, point.y, 4 * point.scale, 0, TAU);
      ctx.fillStyle = signalColor(heat, .98); ctx.shadowColor = signalColor(heat, .7); ctx.shadowBlur = 13; ctx.fill();
      ctx.restore();
    }
    const offset = contact.focus > .1 ? 25 : 10;
    const align = point.x > 660 ? 'right' : 'left';
    const labelX = point.x + (align === 'right' ? -offset : offset);
    label(contact.contact.label, labelX, point.y + (contact.focus > .1 ? -8 : -9),
      contact.focus > .1 ? 11 : 9, Math.max(.32, brightness) * (contact.selected ? .94 : .76), heat, align, 94);
    if (contact.focus > .1) {
      label('SIGNAL LOCK', labelX, point.y + 8, 8, contact.focus * .63, heat, align, 90);
    }
  }

  // A crosshair marks the instrument origin; it is deliberately distinct from a contact blip.
  ctx.beginPath(); ctx.moveTo(center.x - 5, center.y); ctx.lineTo(center.x + 5, center.y);
  ctx.moveTo(center.x, center.y - 5); ctx.lineTo(center.x, center.y + 5);
  ctx.strokeStyle = signalColor(0, .62); ctx.lineWidth = 1; ctx.stroke();
  ctx.restore();
  return target;
}
