import { filmText, signalColor, type FilmFonts } from '../filmDrawing';
import { drawRotor } from './drawRotor';

export interface VisorOverlayOptions {
  time: number;
  reveal: number;
  focus: number;
  heat: number;
  temperature: number;
  driftX: number;
  driftY: number;
  targetId?: number;
  contactCount?: number;
  sensor?: { label: string; value: string; ratio: number };
  annotationOpacity?: number;
}

const TAU = Math.PI * 2;
const clamp = (value: number) => Math.max(0, Math.min(1, value));

/** Visor-mounted instruments: slow eye movement stays independent of the world target. */
export function drawVisorOverlay(ctx: CanvasRenderingContext2D, fonts: FilmFonts, options: VisorOverlayOptions) {
  const { time, driftX, driftY } = options;
  if (![time, driftX, driftY, options.reveal, options.focus, options.heat, options.temperature].every(Number.isFinite) || options.reveal <= 0) return;
  const reveal = clamp(options.reveal), focus = clamp(options.focus), heat = clamp(options.heat);
  const targetId = options.targetId ?? 3;
  ctx.save();
  ctx.globalAlpha *= reveal;
  ctx.lineWidth = .8; ctx.lineCap = 'butt'; ctx.lineJoin = 'round'; ctx.shadowBlur = 0;
  const text = (value: string, x: number, y: number, size: number, opacity: number, align: CanvasTextAlign = 'left') =>
    filmText(ctx, fonts, value, x, y, size, ctx.globalAlpha * opacity, true, align, signalColor(heat * .35, 1));
  const stroke = (opacity: number, warm = 0) => { ctx.strokeStyle = signalColor(warm, opacity); ctx.stroke(); };

  // These shallow curved rails describe one glass surface around the field of vision.
  for (const side of [-1, 1]) {
    ctx.save(); ctx.translate(side < 0 ? 0 : 1280, 0); ctx.scale(side < 0 ? 1 : -1, 1);
    ctx.beginPath(); ctx.moveTo(207, 123); ctx.bezierCurveTo(100, 159, 20, 260, 25, 377);
    ctx.bezierCurveTo(24, 489, 61, 557, 138, 602); stroke(.18);
    ctx.beginPath(); ctx.moveTo(190, 134); ctx.bezierCurveTo(96, 172, 34, 269, 38, 368);
    stroke(.09);
    ctx.beginPath(); ctx.moveTo(87, 591); ctx.lineTo(123, 617); ctx.lineTo(293, 617); stroke(.27);
    ctx.beginPath(); ctx.moveTo(94, 584); ctx.lineTo(128, 608); ctx.lineTo(171, 608); stroke(.5);
    for (let index = 0; index < 11; index++) {
      const y = 220 + index * 28;
      const x = 39 + Math.pow((y - 370) / 180, 2) * 24;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (index % 5 === 0 ? 13 : 6), y); stroke(.28);
    }
    ctx.restore();
  }

  // A heading tape glides behind a fixed center indicator, like optics attached to a visor.
  const heading = 180 + driftX * .16 + Math.sin(time * .17) * 2;
  ctx.save(); ctx.beginPath(); ctx.rect(370, 96, 540, 42); ctx.clip();
  for (let degree = 135; degree <= 225; degree += 3) {
    const x = 640 + (degree - heading) * 10;
    const major = degree % 15 === 0;
    const fade = Math.max(0, 1 - Math.abs(x - 640) / 270);
    ctx.beginPath(); ctx.moveTo(x, 117); ctx.lineTo(x, major ? 106 : 112); stroke(fade * (major ? .65 : .28));
    if (major) text(degree === 180 ? 'S' : String(degree), x, 102, 10, fade * .58, 'center');
  }
  ctx.restore();
  ctx.beginPath(); ctx.moveTo(635, 127); ctx.lineTo(640, 121); ctx.lineTo(645, 127); stroke(.85);
  text(`${heading.toFixed(1)}°`, 640, 146, 10, .5, 'center');

  text('OPTICAL LINK', 77, 177, 10, .43);
  text('ONLINE', 77, 198, 17, .76);
  ctx.beginPath(); ctx.moveTo(78, 212); ctx.lineTo(218, 212); stroke(.24);
  text('EXPOSURE', 77, 233, 9, .4);
  text(`${(1.24 + Math.sin(time * .4) * .06).toFixed(2)} EV`, 218, 234, 12, .7, 'right');
  text('TRACK CONF.', 77, 254, 9, .4);
  text(`${(64 + focus * 35).toFixed(1)} %`, 218, 255, 12, .75, 'right');

  // Only the visible part of the peripheral radar is projected onto the glass.
  ctx.save(); ctx.beginPath(); ctx.rect(0, 278, 282, 321); ctx.clip();
  ctx.translate(driftX * .05, driftY * .035);
  drawRotor(ctx, { x: 80, y: 435, radius: 190, time, reveal: 1, speed: .34, variant: 'segments' });
  drawRotor(ctx, { x: 80, y: 435, radius: 145, time, reveal: 1, speed: .64, variant: 'sweep' });
  ctx.beginPath(); ctx.arc(80, 435, 102, 0, TAU); stroke(.1);
  ctx.beginPath(); ctx.moveTo(80, 283); ctx.lineTo(80, 586);
  ctx.moveTo(0, 435); ctx.lineTo(236, 435); stroke(.11);
  const contactCount = options.contactCount ?? 4;
  for (let index = 0; index < contactCount; index++) {
    const angle = index * 1.74 + .4 + Math.sin(time * .08 + index) * .025;
    const radius = 47 + index % 4 * 19;
    const x = 80 + Math.cos(angle) * radius, y = 435 + Math.sin(angle) * radius;
    const pulse = .45 + .2 * Math.sin(time * 1.8 - index);
    ctx.beginPath(); ctx.arc(x, y, index === targetId - 1 ? 3 : 1.6, 0, TAU);
    ctx.fillStyle = signalColor(index === targetId - 1 ? heat : 0, pulse); ctx.fill();
    if (index === targetId - 1) {
      ctx.beginPath(); ctx.arc(x, y, 8 + focus * 3, 0, TAU); stroke(.25, heat);
    }
  }
  text(String(contactCount).padStart(2, '0'), 80, 431, 21, .8, 'center');
  text('CONTACTS', 80, 450, 9, .4, 'center');
  for (let index = 0; index < 6; index++) {
    const angle = -1.3 + index * .47;
    const x = 80 + Math.cos(angle) * 171, y = 435 + Math.sin(angle) * 171;
    text(String(index * 30).padStart(3, '0'), x, y + 3, 8, .4, 'center');
  }
  ctx.restore();

  ctx.save(); ctx.globalAlpha *= 1 - clamp(options.annotationOpacity ?? 0) * .9;
  text('SENSOR ARRAY', 1205, 179, 10, .43, 'right');
  text(focus > .8 ? `LOCK / ${String(targetId).padStart(2, '0')}` : 'ACQUIRING', 1205, 201, 17, .78, 'right');
  text(options.sensor?.label ?? 'THERMAL', 1081, 231, 9, .45);
  text(options.sensor?.value ?? `${options.temperature.toFixed(1)}°`, 1205, 252, 25, .85, 'right');
  for (let index = 0; index < 23; index++) {
    const active = index / 23 < (options.sensor?.ratio ?? .53 + heat * .42);
    ctx.fillStyle = signalColor(heat, active ? .43 : .07);
    ctx.fillRect(1081 + index * 5.5, 265, 3, 7);
  }

  // A narrow signal trace and vertical scale reinforce the edge without becoming another card.
  ctx.save(); ctx.beginPath(); ctx.rect(1067, 300, 149, 243); ctx.clip();
  ctx.beginPath(); ctx.moveTo(1210, 311); ctx.lineTo(1210, 529); stroke(.18);
  for (let index = 0; index < 23; index++) {
    const y = 311 + index * 9.5;
    ctx.beginPath(); ctx.moveTo(1210, y); ctx.lineTo(index % 5 === 0 ? 1194 : 1203, y); stroke(index % 5 === 0 ? .5 : .19);
  }
  ctx.beginPath();
  for (let index = 0; index <= 106; index++) {
    const y = 314 + index * 2;
    const phase = index * .16 - time * .9;
    const x = 1145 + Math.sin(phase) * (10 + heat * 11) + Math.sin(phase * 2.3) * 4;
    if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  stroke(.44, heat);
  const signalY = 315 + ((time * 19) % 204 + 204) % 204;
  ctx.beginPath(); ctx.moveTo(1102, signalY); ctx.lineTo(1186, signalY); stroke(.26, heat);
  ctx.restore();
  text('STREAM 04', 1205, 563, 10, .55, 'right');
  text(`${Math.floor(48 + time * 12).toString().padStart(5, '0')} / RX`, 1205, 582, 9, .38, 'right');
  ctx.restore();

  if (!options.sensor) {
  text('LOCAL POSITION', 331, 619, 9, .35);
  text(`${(12.68 + driftX * .004).toFixed(2)} / ${(4.12 + driftY * .004).toFixed(2)} / 1.72`, 331, 637, 11, .58);
  text('VISUAL ASSIST  /  LINE 01', 949, 619, 9, .45, 'right');
  text(focus > .8 ? 'OBJECT TELEMETRY SYNCHRONIZED' : 'SEARCHING FOR EQUIPMENT SIGNATURE', 949, 637, 9, .6, 'right');
  }
  ctx.restore();
}
