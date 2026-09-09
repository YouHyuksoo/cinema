import type { FilmFonts } from '../filmDrawing';
import { finiteUnit as clamp } from '../filmMath';
import { phoneCircle, phoneLabel, phoneOutline, phonePath, phonePlate, type PhoneProject } from './phoneDrawing';


function appIcon(ctx: CanvasRenderingContext2D, project: PhoneProject, index: number, x: number, y: number, z: number) {
  phonePath(ctx, project, phoneOutline(x, y, z, 35, 35, 8), true);
  ctx.fillStyle = ['#287858', '#377ca0', '#687784', '#394553'][index]; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = .6; ctx.stroke();
  const stroke = (points: { x: number; y: number }[], closed = false) => {
    phonePath(ctx, project, points.map(point => ({ x: x + point.x, y: y + point.y, z: z - .1 })), closed);
    ctx.strokeStyle = '#e9edf2'; ctx.lineWidth = 1.8; ctx.stroke();
  };
  if (index === 0) {
    stroke([{ x: -7, y: -8 }, { x: -7, y: -1 }, { x: -1, y: 6 }, { x: 7, y: 8 },
      { x: 9, y: 4 }, { x: 4, y: 1 }, { x: 2, y: 4 }, { x: -3, y: 0 },
      { x: -2, y: -4 }, { x: -4, y: -8 }], true);
  } else if (index === 1) {
    stroke([{ x: -9, y: -7 }, { x: 9, y: -7 }, { x: 9, y: 5 }, { x: 0, y: 5 },
      { x: -5, y: 9 }, { x: -5, y: 5 }, { x: -9, y: 5 }], true);
    stroke([{ x: -5, y: -2 }, { x: 5, y: -2 }]); stroke([{ x: -5, y: 1 }, { x: 2, y: 1 }]);
  } else if (index === 2) {
    stroke([{ x: -9, y: -5 }, { x: -4, y: -5 }, { x: -3, y: -8 }, { x: 4, y: -8 },
      { x: 5, y: -5 }, { x: 9, y: -5 }, { x: 9, y: 7 }, { x: -9, y: 7 }], true);
    phoneCircle(ctx, project, x, y + 1, z - .1, 4); ctx.stroke();
  } else {
    for (let row = 0; row < 2; row++) for (let column = 0; column < 2; column++) {
      phonePath(ctx, project, phoneOutline(x - 5 + column * 10, y - 5 + row * 10, z - .1, 5.5, 5.5, 1.5), true);
      ctx.fillStyle = '#e3e9ef'; ctx.fill();
    }
  }
}

/** A complete modern phone display: opaque OLED, black cover glass and a machined metal edge. */
export function drawPhoneDisplay(ctx: CanvasRenderingContext2D, project: PhoneProject,
  fonts: FilmFonts, time: number, focus: number, opening: number): void {
  const t = Number.isFinite(time) ? Math.max(0, time) : 0;
  const active = clamp(focus), fold = 6 + clamp(opening) * 10;
  ctx.save();
  // The short display flex is tucked behind the lower glass instead of hanging outside the handset.
  phonePath(ctx, project, [{ x: -14, y: 170, z: 3 }, { x: 14, y: 170, z: 3 },
    { x: 12, y: 193, z: fold }, { x: -12, y: 193, z: fold }], true);
  ctx.fillStyle = '#986235'; ctx.fill(); ctx.strokeStyle = '#bc8a57'; ctx.lineWidth = .7; ctx.stroke();
  for (let index = 0; index < 8; index++) {
    const x = -10.5 + index * 3;
    phonePath(ctx, project, [{ x, y: 172, z: 2.8 }, { x: x * .8, y: 190, z: fold - .2 }]);
    ctx.strokeStyle = '#d9b875'; ctx.lineWidth = .7; ctx.stroke();
  }
  phonePlate(ctx, project, { x: 0, y: 0, z: 0, width: 240, height: 420, radius: 27, depth: 3,
    fill: '#06080c', edge: '#929aa3', side: '#666f79' });
  phonePath(ctx, project, phoneOutline(0, 0, -1.65, 236, 416, 25), true);
  ctx.strokeStyle = '#171c23'; ctx.lineWidth = 1.5; ctx.stroke();
  const glassZ = -1.95;
  const a = project({ x: -110, y: -202, z: glassZ }), b = project({ x: 106, y: 202, z: glassZ });
  const wallpaper = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
  wallpaper.addColorStop(0, '#091424'); wallpaper.addColorStop(.48, '#1d3f62');
  wallpaper.addColorStop(.78, '#10253e'); wallpaper.addColorStop(1, '#080f1d');
  phonePath(ctx, project, phoneOutline(0, 0, glassZ, 230, 404, 22), true);
  ctx.fillStyle = wallpaper; ctx.fill();
  ctx.save(); ctx.clip();
  // Broad shaded folds read as a normal wallpaper, with no external HUD graphics on the OLED.
  const wave = (offset: number, tone: string) => {
    const shift = Math.sin(t * .075) * 2;
    const points = Array.from({ length: 49 }, (_, index) => {
      const y = -185 + index / 48 * 430;
      return { x: -108 + offset + Math.sin(index / 48 * Math.PI * 1.12) * 95 + shift, y, z: glassZ - .03 };
    });
    phonePath(ctx, project, [...points, { x: 170, y: 245, z: glassZ - .03 },
      { x: 170, y: -185, z: glassZ - .03 }], true);
    ctx.fillStyle = tone; ctx.fill();
  };
  wave(10, '#23496a'); wave(32, '#1b3a59'); wave(48, '#152c45');
  ctx.restore();
  const z = -2.2;
  phonePlate(ctx, project, { x: 0, y: -206, z: -1.8, width: 42, height: 2.1, radius: 1, depth: .35,
    fill: '#020305', side: '#13171d', edge: '#444b53' });
  phoneCircle(ctx, project, 0, -184, z, 5.2); ctx.fillStyle = '#020408'; ctx.fill();
  ctx.strokeStyle = '#1c2532'; ctx.lineWidth = 1.1; ctx.stroke();
  phoneCircle(ctx, project, -.4, -184.6, z - .1, 2.25); ctx.fillStyle = '#1a3042'; ctx.fill();
  phoneCircle(ctx, project, -1.1, -185.1, z - .2, .8); ctx.fillStyle = '#667d90'; ctx.fill();
  phoneLabel(ctx, project, '14:32', -91, -180, z, 7.5, fonts.mono, '#dce3eb');
  phonePath(ctx, project, phoneOutline(85, -184, z, 15, 7, 1.5), true);
  ctx.lineWidth = .9; ctx.strokeStyle = '#dce3eb'; ctx.stroke();
  phonePath(ctx, project, phoneOutline(84, -184, z - .05, 10.5, 4, .8), true);
  ctx.fillStyle = '#dce3eb'; ctx.fill();
  for (let index = 0; index < 4; index++) {
    phonePath(ctx, project, [{ x: 60 + index * 3, y: -181, z }, { x: 60 + index * 3, y: -183 - index, z }]);
    ctx.lineWidth = 1.5; ctx.strokeStyle = '#dce3eb'; ctx.stroke();
  }
  phoneLabel(ctx, project, '14:32', 0, -106, z, 49, fonts.label, '#f2f4f7', 'center');
  phoneLabel(ctx, project, 'A U R O R A', 0, -80, z, 8, fonts.mono, '#b6c4d4', 'center');
  for (let index = 0; index < 4; index++) appIcon(ctx, project, index, -78 + index * 52, 151, z);
  phonePath(ctx, project, [{ x: -30, y: 191, z }, { x: 30, y: 191, z }]);
  ctx.strokeStyle = '#dce3eb'; ctx.lineWidth = 2.5; ctx.stroke();
  // Opening moves the glass as a solid module; it never fades the display material.
  phonePath(ctx, project, [{ x: -112, y: -163, z: -2.35 }, { x: -106, y: -187, z: -2.35 },
    { x: -94, y: -197, z: -2.35 }, { x: 38, y: -199, z: -2.35 }]);
  ctx.strokeStyle = 'rgba(241,245,250,' + (.23 + active * .1) + ')'; ctx.lineWidth = 1; ctx.stroke();
  phonePath(ctx, project, [{ x: 115, y: -138, z: -2.2 }, { x: 115, y: 159, z: -2.2 }]);
  ctx.strokeStyle = 'rgba(208,217,228,.11)'; ctx.lineWidth = .7; ctx.stroke();
  ctx.restore();
}
