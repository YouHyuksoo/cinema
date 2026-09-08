import type { HoloPoint, HoloProjectedPoint } from '../holoSpace';

export type PhoneProject = (point: HoloPoint) => HoloProjectedPoint;
export interface PhonePlate {
  x: number; y: number; z: number; width: number; height: number; depth: number; radius: number;
  fill: string; edge: string; side?: string;
}

export function phonePath(ctx: CanvasRenderingContext2D, project: PhoneProject, points: readonly HoloPoint[], closed = false) {
  ctx.beginPath();
  points.forEach((point, index) => {
    const p = project(point);
    if (index) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y);
  });
  if (closed) ctx.closePath();
}

export function phoneOutline(x: number, y: number, z: number, width: number, height: number, radius: number): HoloPoint[] {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  return Array.from({ length: 4 }, (_, corner) => {
    const angle = corner * Math.PI / 2;
    const cx = x + (corner === 0 || corner === 3 ? 1 : -1) * (width / 2 - r);
    const cy = y + (corner < 2 ? 1 : -1) * (height / 2 - r);
    return Array.from({ length: 7 }, (_, step) => ({
      x: cx + Math.cos(angle + step / 6 * Math.PI / 2) * r,
      y: cy + Math.sin(angle + step / 6 * Math.PI / 2) * r, z,
    }));
  }).flat();
}

/** Rounded manufactured layers, with the same projection for their face, thickness and wiring. */
export function phonePlate(ctx: CanvasRenderingContext2D, project: PhoneProject, plate: PhonePlate) {
  const front = phoneOutline(plate.x, plate.y, plate.z - plate.depth / 2, plate.width, plate.height, plate.radius);
  const rear = front.map(point => ({ ...point, z: point.z + plate.depth }));
  phonePath(ctx, project, rear, true); ctx.fillStyle = plate.side ?? plate.fill; ctx.fill();
  ctx.strokeStyle = plate.edge; ctx.lineWidth = .65; ctx.stroke();
  if (plate.depth > 0) {
    const faces = front.map((point, index) => {
      const next = (index + 1) % front.length;
      const points = [point, front[next], rear[next], rear[index]];
      return { points, depth: points.reduce((sum, p) => sum + project(p).depth, 0) };
    }).sort((a, b) => b.depth - a.depth);
    for (const face of faces) {
      phonePath(ctx, project, face.points, true);
      ctx.fillStyle = plate.side ?? plate.fill; ctx.fill();
    }
  }
  phonePath(ctx, project, front, true); ctx.fillStyle = plate.fill; ctx.fill();
  ctx.strokeStyle = plate.edge; ctx.lineWidth = 1; ctx.stroke();
}

export function phoneCircle(ctx: CanvasRenderingContext2D, project: PhoneProject,
  x: number, y: number, z: number, radius: number) {
  phonePath(ctx, project, Array.from({ length: 41 }, (_, index) => {
    const angle = index / 40 * Math.PI * 2;
    return { x: x + Math.cos(angle) * radius, y: y + Math.sin(angle) * radius, z };
  }), true);
}

/** Local affine text follows the manufactured face instead of floating in screen coordinates. */
export function phoneLabel(ctx: CanvasRenderingContext2D, project: PhoneProject, text: string,
  x: number, y: number, z: number, size: number, font: string, color: string, align: CanvasTextAlign = 'left') {
  const p = project({ x, y, z }), px = project({ x: x + 1, y, z }), py = project({ x, y: y + 1, z });
  ctx.save();
  ctx.transform(px.x - p.x, px.y - p.y, py.x - p.x, py.y - p.y, p.x, p.y);
  ctx.font = `${size}px ${font}`; ctx.fillStyle = color; ctx.textAlign = align;
  ctx.fillText(text, 0, 0); ctx.restore();
}
