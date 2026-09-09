export const smooth = (a: number, b: number, t: number) => {
  const x = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
};
export const windowAt = (a: number, b: number, t: number) => smooth(a, a + 1.2, t) * (1 - smooth(b - 1.2, b, t));
export interface FilmFonts { label: string; mono: string }
export const DEFAULT_FONTS: FilmFonts = { label: 'sans-serif', mono: 'monospace' };
const CYAN = [95, 227, 255];
const AMBER = [255, 193, 104];

/** Cyan-to-amber heat blend. Called thousands of times per frame, so it must not allocate arrays. */
export function signalColor(heat: number, opacity: number) {
  const r = Math.round(CYAN[0] + (AMBER[0] - CYAN[0]) * heat);
  const g = Math.round(CYAN[1] + (AMBER[1] - CYAN[1]) * heat);
  const b = Math.round(CYAN[2] + (AMBER[2] - CYAN[2]) * heat);
  return `rgba(${r},${g},${b},${opacity})`;
}

const FIT_CACHE_LIMIT = 512;
const fitCache = new Map<string, string>();

/**
 * Truncate `text` with an ellipsis so it fits `maxWidth` under the context's current font.
 * Binary search keeps measureText calls logarithmic, and the result is cached by font, width and
 * text because labels rarely change between frames while measureText forces text shaping.
 */
export function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  const key = `${ctx.font}|${maxWidth}|${text}`;
  const cached = fitCache.get(key);
  if (cached !== undefined) return cached;
  let result: string;
  if (maxWidth <= 0) result = '';
  else if (ctx.measureText(text).width <= maxWidth) result = text;
  else if (ctx.measureText('…').width > maxWidth) result = '';
  else {
    const characters = Array.from(text);
    let low = 0, high = characters.length;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (ctx.measureText(characters.slice(0, middle).join('') + '…').width <= maxWidth) low = middle;
      else high = middle - 1;
    }
    result = characters.slice(0, low).join('') + '…';
  }
  if (fitCache.size >= FIT_CACHE_LIMIT) fitCache.delete(fitCache.keys().next().value!);
  fitCache.set(key, result);
  return result;
}

export function filmText(ctx: CanvasRenderingContext2D, fonts: FilmFonts, value: string, x: number, y: number,
  size: number, opacity: number, mono = false, align: CanvasTextAlign = 'left', color = '#d7edf0') {
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, opacity)); ctx.fillStyle = color;
  ctx.font = `${size}px ${mono ? fonts.mono : fonts.label}`; ctx.textAlign = align;
  ctx.fillText(value, x, y); ctx.restore();
}
