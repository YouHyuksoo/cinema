import type { environmentHeatmap } from '../environmentHeatmap';
import type { environmentHeatmapProjection } from '../environmentHeatmapProjection';
import { environmentThermalImage } from './drawEnvironmentThermalField';

type Heatmap = ReturnType<typeof environmentHeatmap>;
type Projection = ReturnType<typeof environmentHeatmapProjection>;
interface GroundVertex { x: number; y: number; u: number; v: number; visible: boolean }
interface GroundBuffer { canvas: HTMLCanvasElement; paint: CanvasRenderingContext2D; mesh: GroundVertex[] }
const COLUMNS = 18, ROWS = 12, MAX_COMPOSITE_SIZE = 1536;
const buffers = new WeakMap<CanvasRenderingContext2D, GroundBuffer>();

function groundBuffer(ctx: CanvasRenderingContext2D): GroundBuffer | null {
  const cached = buffers.get(ctx);
  if (cached) return cached;
  const canvas = document.createElement('canvas'), paint = canvas.getContext('2d');
  if (!paint) return null;
  const buffer = { canvas, paint,
    mesh: Array.from({ length: (COLUMNS + 1) * (ROWS + 1) }, () => ({ x: 0, y: 0, u: 0, v: 0, visible: false })) };
  buffers.set(ctx, buffer);
  return buffer;
}

function triangle(paint: CanvasRenderingContext2D, image: HTMLCanvasElement,
  a: GroundVertex, b: GroundVertex, c: GroundVertex, width: number, height: number) {
  // The camera stays above the factory: triangles crossing the near plane lie off-screen.
  if (!a.visible || !b.visible || !c.visible
    || Math.max(a.x, b.x, c.x) < 0 || Math.min(a.x, b.x, c.x) > width
    || Math.max(a.y, b.y, c.y) < 0 || Math.min(a.y, b.y, c.y) > height) return;
  const bu = b.u - a.u, bv = b.v - a.v, cu = c.u - a.u, cv = c.v - a.v;
  const determinant = bu * cv - bv * cu;
  if (Math.abs(determinant) < 1e-8) return;
  const bx = b.x - a.x, by = b.y - a.y, cx = c.x - a.x, cy = c.y - a.y;
  if (Math.abs(bx * cy - by * cx) < .01) return;
  const xx = (bx * cv - cx * bv) / determinant, xy = (by * cv - cy * bv) / determinant;
  const yx = (cx * bu - bx * cu) / determinant, yy = (cy * bu - by * cu) / determinant;
  paint.save(); paint.beginPath();
  paint.moveTo(a.x, a.y); paint.lineTo(b.x, b.y); paint.lineTo(c.x, c.y); paint.closePath(); paint.clip();
  paint.setTransform(xx, xy, yx, yy, a.x - xx * a.u - yx * a.v, a.y - xy * a.u - yy * a.v);
  paint.drawImage(image, 0, 0); paint.restore();
}

/** Carry the continuous thermal field on the factory floor through the flight camera. */
export function drawEnvironmentThermalGround(ctx: CanvasRenderingContext2D, model: Heatmap,
  projection: Projection, alpha: number, reveal: number) {
  if (!(alpha > .001 && reveal > .001 && ctx.canvas.width > 0 && ctx.canvas.height > 0)) return;
  const image = environmentThermalImage(ctx, model, reveal), buffer = groundBuffer(ctx);
  if (!image || !buffer) return;
  const { canvas, paint, mesh } = buffer;
  const scale = Math.min(1, MAX_COMPOSITE_SIZE / Math.max(ctx.canvas.width, ctx.canvas.height));
  const width = Math.max(1, Math.ceil(ctx.canvas.width * scale));
  const height = Math.max(1, Math.ceil(ctx.canvas.height * scale));
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const scaleX = width / ctx.canvas.width, scaleY = height / ctx.canvas.height;
  const transform = ctx.getTransform(), bounds = model.bounds;
  const coordinateLimit = Math.max(width, height) * 128;
  for (let row = 0; row <= ROWS; row++) {
    for (let column = 0; column <= COLUMNS; column++) {
      const vertex = mesh[row * (COLUMNS + 1) + column];
      const point = projection.point(bounds.x + column / COLUMNS * bounds.width,
        bounds.y + row / ROWS * bounds.height);
      vertex.u = column / COLUMNS * image.width; vertex.v = row / ROWS * image.height;
      vertex.x = (transform.a * point.x + transform.c * point.y + transform.e) * scaleX;
      vertex.y = (transform.b * point.x + transform.d * point.y + transform.f) * scaleY;
      vertex.visible = point.visible && point.depth >= projection.camera.near
        && Number.isFinite(vertex.x) && Number.isFinite(vertex.y)
        && Math.abs(vertex.x) < coordinateLimit && Math.abs(vertex.y) < coordinateLimit;
    }
  }
  paint.setTransform(1, 0, 0, 1, 0, 0); paint.clearRect(0, 0, width, height);
  paint.globalAlpha = 1; paint.imageSmoothingEnabled = true; paint.imageSmoothingQuality = 'high';
  // Sum complementary shared-edge coverage before applying the floor opacity once.
  paint.globalCompositeOperation = 'lighter';
  for (let row = 0; row < ROWS; row++) {
    for (let column = 0; column < COLUMNS; column++) {
      const index = row * (COLUMNS + 1) + column;
      const a = mesh[index], b = mesh[index + 1], c = mesh[index + COLUMNS + 1], d = mesh[index + COLUMNS + 2];
      triangle(paint, image, a, b, d, width, height);
      triangle(paint, image, a, d, c, width, height);
    }
  }
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha)) * .72;
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(canvas, 0, 0, width, height, 0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
}
