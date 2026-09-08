export const smooth = (a: number, b: number, t: number) => {
  const x = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
};
export const windowAt = (a: number, b: number, t: number) => smooth(a, a + 1.2, t) * (1 - smooth(b - 1.2, b, t));
export interface FilmFonts { label: string; mono: string }
export const DEFAULT_FONTS: FilmFonts = { label: 'sans-serif', mono: 'monospace' };
const CYAN = [95, 227, 255];
const AMBER = [255, 193, 104];

export function signalColor(heat: number, opacity: number) {
  return `rgba(${CYAN.map((v, i) => Math.round(v + (AMBER[i] - v) * heat)).join(',')},${opacity})`;
}

export function filmText(ctx: CanvasRenderingContext2D, fonts: FilmFonts, value: string, x: number, y: number,
  size: number, opacity: number, mono = false, align: CanvasTextAlign = 'left', color = '#d7edf0') {
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, opacity)); ctx.fillStyle = color;
  ctx.font = `${size}px ${mono ? fonts.mono : fonts.label}`; ctx.textAlign = align;
  ctx.fillText(value, x, y); ctx.restore();
}
