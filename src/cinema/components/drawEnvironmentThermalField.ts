import { environmentTemperatureAt, environmentTemperatureColor, type environmentHeatmap } from '../environmentHeatmap';

type Heatmap = ReturnType<typeof environmentHeatmap>;
interface FieldBuffer { key: number[]; field: HTMLCanvasElement; mask: HTMLCanvasElement }
const fields = new WeakMap<CanvasRenderingContext2D, FieldBuffer>();
const SAMPLE_SIZE = 4;

/** Flat numeric signature of everything the sampled field depends on; compared without allocating per frame. */
function fieldKey(model: Heatmap): number[] {
  const key = [model.bounds.x, model.bounds.y, model.bounds.width, model.bounds.height, model.domain.min, model.domain.max];
  for (const room of model.rooms) key.push(room.pin.x, room.pin.y, room.temperature ?? Number.NEGATIVE_INFINITY);
  return key;
}
function sameKey(a: number[], b: number[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Cache the sampled field; playback animates its visibility without changing sensor readings. */
function fieldBuffer(ctx: CanvasRenderingContext2D, model: Heatmap) {
  const key = fieldKey(model);
  const previous = fields.get(ctx);
  if (previous && sameKey(previous.key, key)) return previous;
  const field = previous?.field ?? document.createElement('canvas');
  const mask = previous?.mask ?? document.createElement('canvas');
  field.width = mask.width = Math.ceil(model.bounds.width / SAMPLE_SIZE);
  field.height = mask.height = Math.ceil(model.bounds.height / SAMPLE_SIZE);
  const paint = field.getContext('2d');
  if (!paint) return null;
  for (let y = 0; y < field.height; y++) {
    for (let x = 0; x < field.width; x++) {
      const value = environmentTemperatureAt(model.rooms,
        model.bounds.x + (x + .5) * model.bounds.width / field.width,
        model.bounds.y + (y + .5) * model.bounds.height / field.height);
      paint.fillStyle = environmentTemperatureColor(value, model.domain).color;
      paint.fillRect(x, y, 1, 1);
    }
  }
  const result = { key, field, mask };
  fields.set(ctx, result);
  return result;
}

/** Share the cached thermal pixels and their reveal mask with planar and spatial renderers. */
export function environmentThermalImage(ctx: CanvasRenderingContext2D, model: Heatmap,
  reveal: number): HTMLCanvasElement | null {
  const buffer = fieldBuffer(ctx, model);
  if (!buffer) return null;
  const { field, mask } = buffer, b = model.bounds;
  let image: HTMLCanvasElement = field;
  if (reveal < .999) {
    const paint = mask.getContext('2d');
    if (!paint) return null;
    paint.clearRect(0, 0, mask.width, mask.height);
    const radius = Math.max(1, reveal * 150);
    for (const room of model.rooms) {
      if (room.temperature === null) continue;
      const x = (room.pin.x - b.x) / b.width * mask.width;
      const y = (room.pin.y - b.y) / b.height * mask.height;
      const glow = paint.createRadialGradient(x, y, 0, x, y, radius);
      glow.addColorStop(0, 'rgba(255,255,255,1)');
      glow.addColorStop(.5, 'rgba(255,255,255,1)');
      glow.addColorStop(1, 'rgba(255,255,255,0)');
      paint.fillStyle = glow; paint.fillRect(0, 0, mask.width, mask.height);
    }
    paint.globalCompositeOperation = 'source-in';
    paint.drawImage(field, 0, 0);
    paint.globalCompositeOperation = 'source-over';
    image = mask;
  }
  return image;
}

export function drawEnvironmentThermalField(ctx: CanvasRenderingContext2D, model: Heatmap,
  alpha: number, reveal: number) {
  const image = environmentThermalImage(ctx, model, reveal);
  if (!image) return;
  const b = model.bounds;
  ctx.save(); ctx.globalAlpha = alpha * .82;
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, b.x, b.y, b.width, b.height);
  ctx.restore();
}
