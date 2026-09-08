import type { FilmFonts } from '../filmDrawing';
import { phoneCircle, phoneLabel, phoneOutline, phonePath, phonePlate, type PhoneProject } from './phoneDrawing';

/** Solid graphite rear cover with a recessed inner face and real mounting features. */
export function drawPhoneShell(ctx: CanvasRenderingContext2D, project: PhoneProject, fonts: FilmFonts) {
  ctx.save();
  phonePlate(ctx, project, { x: 0, y: 0, z: 0, width: 240, height: 420, radius: 27, depth: 9,
    fill: '#252e36', side: '#68717a', edge: '#a3abb2' });
  phonePlate(ctx, project, { x: 0, y: 0, z: -4.65, width: 224, height: 404, radius: 21, depth: .5,
    fill: '#171e24', side: '#11171d', edge: '#080d12' });
  phonePath(ctx, project, phoneOutline(0, 0, -4.95, 232, 412, 24), true);
  ctx.lineWidth = 1.1; ctx.strokeStyle = '#7c858e'; ctx.stroke();
  phonePath(ctx, project, phoneOutline(0, 0, -5, 219, 399, 19), true);
  ctx.lineWidth = .65; ctx.strokeStyle = '#35404a'; ctx.stroke();

  // The camera openings sit in a stamped support pocket on the inside of the lid.
  phonePlate(ctx, project, { x: -65, y: -118, z: -5.1, width: 54, height: 105, radius: 17, depth: .45,
    fill: '#212a32', side: '#121a21', edge: '#46525e' });
  for (const y of [-140, -96]) {
    phoneCircle(ctx, project, -65, y, -5.5, 19.2); ctx.fillStyle = '#929ba3'; ctx.fill();
    phoneCircle(ctx, project, -65, y, -5.6, 17.2); ctx.fillStyle = '#05080c'; ctx.fill();
    phoneCircle(ctx, project, -65, y, -5.7, 14.2); ctx.strokeStyle = '#384551'; ctx.lineWidth = 1; ctx.stroke();
    phonePath(ctx, project, [{ x: -79, y: y - 8, z: -5.75 }, { x: -75, y: y - 13, z: -5.75 },
      { x: -69, y: y - 16, z: -5.75 }]);
    ctx.strokeStyle = '#d0d6dc'; ctx.lineWidth = .8; ctx.stroke();
  }
  for (const x of [-102, 102]) for (const y of [-181, -30, 182]) {
    phoneCircle(ctx, project, x, y, -5.2, 4.5); ctx.fillStyle = '#697781'; ctx.fill();
    phoneCircle(ctx, project, x, y, -5.3, 2.5); ctx.fillStyle = '#202a32'; ctx.fill();
    ctx.lineWidth = .6; ctx.strokeStyle = '#b6bec5'; ctx.stroke();
    for (const side of [-1, 1]) {
      phonePath(ctx, project, [{ x: x - 1.45, y: y - side * 1.45, z: -5.4 },
        { x: x + 1.45, y: y + side * 1.45, z: -5.4 }]);
      ctx.strokeStyle = '#070c11'; ctx.lineWidth = .8; ctx.stroke();
    }
  }
  // Antenna breaks and physical side buttons remain neutral machined materials.
  for (const y of [-128, 137]) for (const side of [-1, 1]) {
    phonePath(ctx, project, [{ x: side * 114, y, z: -4.8 }, { x: side * 120, y, z: -4.3 },
      { x: side * 120, y, z: 4.3 }]);
    ctx.strokeStyle = '#c4c9ce'; ctx.lineWidth = 1.8; ctx.stroke();
  }
  for (const [x, y, height] of [[121, -59, 39], [-121, -74, 28], [-121, -36, 28]]) {
    phonePlate(ctx, project, { x, y, z: 0, width: 3, height, radius: 1.4, depth: 5.7,
      fill: '#8c959e', side: '#3a454f', edge: '#c0c7cd' });
  }
  phonePlate(ctx, project, { x: 0, y: 195, z: -5.2, width: 31, height: 7, radius: 3.5, depth: .6,
    fill: '#03070b', side: '#131a22', edge: '#89949e' });
  phonePath(ctx, project, [{ x: -9, y: 195, z: -5.6 }, { x: 9, y: 195, z: -5.6 }]);
  ctx.strokeStyle = '#56616c'; ctx.lineWidth = 1.1; ctx.stroke();
  for (const side of [-1, 1]) for (let hole = 0; hole < 7; hole++) {
    phoneCircle(ctx, project, side * (41 + hole * 6), 195, -5.2, 1.45);
    ctx.fillStyle = '#03070b'; ctx.fill(); ctx.strokeStyle = '#616e79'; ctx.lineWidth = .55; ctx.stroke();
  }
  // Matte support ribs and insulation define a manufactured cavity rather than a translucent panel.
  for (const y of [-53, 116]) {
    phonePath(ctx, project, [{ x: -96, y, z: -5 }, { x: -72, y: y + 2, z: -5.3 },
      { x: 73, y: y + 2, z: -5.3 }, { x: 96, y, z: -5 }]);
    ctx.strokeStyle = '#2d3842'; ctx.lineWidth = 3.5; ctx.stroke();
    phonePath(ctx, project, [{ x: -88, y: y - 1, z: -5.3 }, { x: 86, y: y - 1, z: -5.3 }]);
    ctx.strokeStyle = '#45515c'; ctx.lineWidth = .55; ctx.stroke();
  }
  phonePath(ctx, project, phoneOutline(8, 28, -5.3, 125, 112, 8), true);
  ctx.fillStyle = '#141a20'; ctx.fill(); ctx.strokeStyle = '#26323c'; ctx.lineWidth = .7; ctx.stroke();
  phoneLabel(ctx, project, 'A U R O R A', 8, 23, -5.5, 9, fonts.mono, '#53616e', 'center');
  phoneLabel(ctx, project, 'AL 7000 / FRAME', 8, 39, -5.5, 5.5, fonts.mono, '#42505d', 'center');
  phonePath(ctx, project, [{ x: -113, y: -159, z: -4.8 }, { x: -111, y: -186, z: -4.8 },
    { x: -97, y: -201, z: -4.8 }, { x: 66, y: -205, z: -4.8 }]);
  ctx.strokeStyle = 'rgba(232,237,242,.36)'; ctx.lineWidth = .85; ctx.stroke();
  ctx.restore();
}
