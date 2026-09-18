import { signalColor } from '../filmDrawing';

export const MOUNTER_PITCH = 350;
export const MOUNTER_BOARD_Y = 303;

/** One world-space conveyor shared by the gaps and each machine's inspection window. */
export function drawMounterTransport(ctx: CanvasRenderingContext2D, focus: number, count: number, time: number) {
  const left = 640 - focus * MOUNTER_PITCH - 260;
  const length = Math.max(1, count - 1) * MOUNTER_PITCH + 520;
  const y = MOUNTER_BOARD_Y;
  ctx.fillStyle = '#263638'; ctx.fillRect(left, y - 12, length, 24);
  ctx.strokeStyle = '#829b9c'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(left, y - 13); ctx.lineTo(left + length, y - 13);
  ctx.moveTo(left, y + 13); ctx.lineTo(left + length, y + 13); ctx.stroke();
  ctx.strokeStyle = signalColor(0, .28); ctx.lineWidth = 1;
  for (let offset = 0; offset < length; offset += 16) {
    ctx.beginPath(); ctx.moveTo(left + offset, y - 9); ctx.lineTo(left + offset, y + 9); ctx.stroke();
  }
  const boards = Math.ceil(length / 240), spacing = length / boards;
  for (let index = 0; index < boards; index++) {
    const x = left + ((Math.max(0, time) * 65 + index * spacing) % length);
    ctx.fillStyle = '#176f54'; ctx.fillRect(x - 33, y - 9, 66, 18);
    ctx.strokeStyle = '#8bdbad'; ctx.strokeRect(x - 33, y - 9, 66, 18);
    for (let chip = 0; chip < 5; chip++) {
      ctx.fillStyle = '#192426'; ctx.fillRect(x - 26 + chip * 12, y - 5, 8, 7);
      ctx.fillStyle = '#c2b47b'; ctx.fillRect(x - 26 + chip * 12, y + 5, 8, 1);
    }
  }
}
