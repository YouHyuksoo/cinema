import { createFilmThemeContext, getFilmContextTheme } from '../filmThemeCanvas';

interface SurfacePoint { x: number; y: number }
export interface ProjectedFilmSurfaceOptions {
  width: number;
  height: number;
  /** Project a point whose origin is the middle of the unrotated surface. */
  project: (x: number, y: number) => SurfacePoint;
  draw: (surfaceContext: CanvasRenderingContext2D) => void;
}

interface MeshPoint extends SurfacePoint { u: number; v: number }
interface SurfaceBuffers {
  source: HTMLCanvasElement;
  theme: ReturnType<typeof createFilmThemeContext>;
  composite: HTMLCanvasElement;
  compositeContext: CanvasRenderingContext2D;
  mesh: MeshPoint[];
}

const COLUMNS = 12;
const ROWS = 8;
const MAX_SOURCE_SIZE = 2048;
const MAX_COMPOSITE_SIZE = 4096;
const buffers = new WeakMap<CanvasRenderingContext2D, SurfaceBuffers>();

function getBuffers(context: CanvasRenderingContext2D): SurfaceBuffers {
  const cached = buffers.get(context);
  if (cached) return cached;
  const source = document.createElement('canvas');
  const composite = document.createElement('canvas');
  const sourceContext = source.getContext('2d');
  const compositeContext = composite.getContext('2d');
  if (!sourceContext || !compositeContext) throw new Error('HUD surface requires a Canvas 2D context.');
  const created = {
    source, composite, compositeContext,
    theme: createFilmThemeContext(sourceContext, getFilmContextTheme(context)),
    mesh: Array.from({ length: (COLUMNS + 1) * (ROWS + 1) }, () => ({ x: 0, y: 0, u: 0, v: 0 })),
  };
  buffers.set(context, created);
  return created;
}

/** Grow in bounded buckets, so motion and scene switches reuse the same backing stores. */
function reserve(canvas: HTMLCanvasElement, width: number, height: number, maximum: number) {
  if (canvas.width < width) canvas.width = Math.min(maximum, 2 ** Math.ceil(Math.log2(width)));
  if (canvas.height < height) canvas.height = Math.min(maximum, 2 ** Math.ceil(Math.log2(height)));
}

function drawTriangle(context: CanvasRenderingContext2D, source: HTMLCanvasElement,
  sourceWidth: number, sourceHeight: number, a: MeshPoint, b: MeshPoint, c: MeshPoint) {
  const bu = b.u - a.u, bv = b.v - a.v, cu = c.u - a.u, cv = c.v - a.v;
  const determinant = bu * cv - bv * cu;
  if (Math.abs(determinant) < 1e-8) return;
  const bx = b.x - a.x, by = b.y - a.y, cx = c.x - a.x, cy = c.y - a.y;
  const xx = (bx * cv - cx * bv) / determinant;
  const xy = (by * cv - cy * bv) / determinant;
  const yx = (cx * bu - bx * cu) / determinant;
  const yy = (cy * bu - by * cu) / determinant;
  context.save();
  context.beginPath(); context.moveTo(a.x, a.y); context.lineTo(b.x, b.y); context.lineTo(c.x, c.y);
  context.closePath(); context.clip();
  context.setTransform(xx, xy, yx, yy, a.x - xx * a.u - yx * a.v, a.y - xy * a.u - yy * a.v);
  context.drawImage(source, 0, 0, sourceWidth, sourceHeight, 0, 0, sourceWidth, sourceHeight);
  context.restore();
}

/** Rasterize a reusable HUD component, then map its whole face through perspective. */
export function drawProjectedFilmSurface(context: CanvasRenderingContext2D,
  { width, height, project, draw }: ProjectedFilmSurfaceOptions) {
  if (!(width > 0 && height > 0 && Number.isFinite(width + height))) return;
  const storage = getBuffers(context);
  const { mesh, source, composite, compositeContext, theme } = storage;
  const transform = context.getTransform();
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, largestScale = 0;

  // Shared vertices make adjacent triangle coverage complementary at the pixel boundary.
  for (let row = 0; row <= ROWS; row++) {
    for (let column = 0; column <= COLUMNS; column++) {
      const index = row * (COLUMNS + 1) + column;
      const point = project((column / COLUMNS - .5) * width, (row / ROWS - .5) * height);
      const vertex = mesh[index];
      vertex.x = transform.a * point.x + transform.c * point.y + transform.e;
      vertex.y = transform.b * point.x + transform.d * point.y + transform.f;
      if (!Number.isFinite(vertex.x + vertex.y)) return;
      minX = Math.min(minX, vertex.x); maxX = Math.max(maxX, vertex.x);
      minY = Math.min(minY, vertex.y); maxY = Math.max(maxY, vertex.y);
      if (column) {
        const previous = mesh[index - 1];
        largestScale = Math.max(largestScale, Math.hypot(vertex.x - previous.x, vertex.y - previous.y) * COLUMNS / width);
      }
      if (row) {
        const previous = mesh[index - COLUMNS - 1];
        largestScale = Math.max(largestScale, Math.hypot(vertex.x - previous.x, vertex.y - previous.y) * ROWS / height);
      }
    }
  }

  const left = Math.max(-2, Math.floor(minX) - 2), top = Math.max(-2, Math.floor(minY) - 2);
  const outputWidth = Math.min(context.canvas.width + 2, Math.ceil(maxX) + 2) - left;
  const outputHeight = Math.min(context.canvas.height + 2, Math.ceil(maxY) + 2) - top;
  if (outputWidth <= 0 || outputHeight <= 0) return;

  // The target transform includes the playback canvas's DPR and viewport scaling.
  const rasterScale = Math.min(4, Math.max(2, largestScale * 1.25), MAX_SOURCE_SIZE / Math.max(width, height));
  const sourceWidth = Math.max(1, Math.ceil(width * rasterScale));
  const sourceHeight = Math.max(1, Math.ceil(height * rasterScale));
  reserve(source, sourceWidth, sourceHeight, MAX_SOURCE_SIZE);
  theme.setTheme(getFilmContextTheme(context));
  const surfaceContext = theme.ctx;
  surfaceContext.setTransform(1, 0, 0, 1, 0, 0);
  surfaceContext.clearRect(0, 0, source.width, source.height);
  surfaceContext.save();
  surfaceContext.setTransform(sourceWidth / width, 0, 0, sourceHeight / height, sourceWidth / 2, sourceHeight / 2);
  try { draw(surfaceContext); } finally { surfaceContext.restore(); }

  const compositeScale = Math.min(1, MAX_COMPOSITE_SIZE / Math.max(outputWidth, outputHeight));
  const compositeWidth = Math.max(1, Math.ceil(outputWidth * compositeScale));
  const compositeHeight = Math.max(1, Math.ceil(outputHeight * compositeScale));
  reserve(composite, compositeWidth, compositeHeight, MAX_COMPOSITE_SIZE);
  compositeContext.setTransform(1, 0, 0, 1, 0, 0);
  compositeContext.clearRect(0, 0, composite.width, composite.height);
  compositeContext.imageSmoothingEnabled = true;
  compositeContext.imageSmoothingQuality = 'high';
  // Add complementary antialias coverage on an isolated transparent layer. Expanding
  // clips or drawing directly with source-over would amplify translucent seam alpha.
  compositeContext.globalCompositeOperation = 'lighter';
  for (let row = 0; row <= ROWS; row++) {
    for (let column = 0; column <= COLUMNS; column++) {
      const vertex = mesh[row * (COLUMNS + 1) + column];
      vertex.u = column / COLUMNS * sourceWidth; vertex.v = row / ROWS * sourceHeight;
      vertex.x = (vertex.x - left) * compositeWidth / outputWidth;
      vertex.y = (vertex.y - top) * compositeHeight / outputHeight;
    }
  }
  for (let row = 0; row < ROWS; row++) {
    for (let column = 0; column < COLUMNS; column++) {
      const index = row * (COLUMNS + 1) + column;
      const a = mesh[index], b = mesh[index + 1], c = mesh[index + COLUMNS + 1], d = mesh[index + COLUMNS + 2];
      drawTriangle(compositeContext, source, sourceWidth, sourceHeight, a, b, d);
      drawTriangle(compositeContext, source, sourceWidth, sourceHeight, a, d, c);
    }
  }

  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.drawImage(composite, 0, 0, compositeWidth, compositeHeight, left, top, outputWidth, outputHeight);
  context.restore();
}
