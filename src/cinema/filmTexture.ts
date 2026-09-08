import { createFilmColorMapper } from './filmThemeCanvas';
import { DEFAULT_FILM_THEME, type FilmThemeId } from './filmThemes';

export type FilmTextureStyle = 'none' | 'glass' | 'film' | 'hologram';

export interface FilmTextureSettings {
  style: FilmTextureStyle;
  intensity: number;
}

export const DEFAULT_FILM_TEXTURE: FilmTextureSettings = { style: 'glass', intensity: .55 };
export const FILM_TEXTURE_STYLES = [
  { value: 'none', label: '없음' },
  { value: 'glass', label: '유리' },
  { value: 'film', label: '필름' },
  { value: 'hologram', label: '홀로그램' },
] as const satisfies readonly { value: FilmTextureStyle; label: string }[];

const VIEW_WIDTH = 1280;
const VIEW_HEIGHT = 720;
type ColorMapper = ReturnType<typeof createFilmColorMapper>;

function surface(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/** The seed is fixed so seeking and pausing produce the same surface. */
function noiseSurface(color: ColorMapper) {
  const canvas = surface(256, 256);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  // Resolve one native CSS color once; the seeded pixel loop only copies its RGB channels.
  ctx.fillStyle = color('#cce1e7'); ctx.fillRect(0, 0, 1, 1);
  const tint = ctx.getImageData(0, 0, 1, 1).data;
  const pixels = ctx.createImageData(canvas.width, canvas.height);
  let seed = 0x51a7f13;
  for (let i = 0; i < pixels.data.length; i += 4) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const grain = seed / 0x100000000;
    pixels.data[i] = tint[0];
    pixels.data[i + 1] = tint[1];
    pixels.data[i + 2] = tint[2];
    pixels.data[i + 3] = Math.round(Math.pow(grain, 5) * 190);
  }
  ctx.putImageData(pixels, 0, 0);
  return canvas;
}

function reflectionSurface(color: ColorMapper) {
  const canvas = surface(320, 180);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const wash = ctx.createRadialGradient(-30, -20, 8, 12, 12, 230);
  wash.addColorStop(0, color('rgba(140,232,255,.32)'));
  wash.addColorStop(.52, color('rgba(97,173,204,.065)'));
  wash.addColorStop(1, color('rgba(97,173,204,0)'));
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, 320, 180);
  const diagonal = ctx.createLinearGradient(0, 0, 320, 125);
  diagonal.addColorStop(0, color('rgba(220,249,255,.05)'));
  diagonal.addColorStop(.2, color('rgba(220,249,255,0)'));
  diagonal.addColorStop(.39, color('rgba(220,249,255,0)'));
  diagonal.addColorStop(.44, color('rgba(220,249,255,.14)'));
  diagonal.addColorStop(.47, color('rgba(220,249,255,.025)'));
  diagonal.addColorStop(.68, color('rgba(220,249,255,0)'));
  diagonal.addColorStop(1, color('rgba(120,221,241,.035)'));
  ctx.fillStyle = diagonal;
  ctx.fillRect(0, 0, 320, 180);
  return canvas;
}

function vignetteSurface(color: ColorMapper) {
  const canvas = surface(320, 180);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const fade = ctx.createRadialGradient(160, 86, 40, 160, 86, 192);
  fade.addColorStop(0, color('rgba(0,4,9,0)'));
  fade.addColorStop(.48, color('rgba(0,4,9,.025)'));
  fade.addColorStop(1, color('rgba(0,4,9,.65)'));
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, 320, 180);
  return canvas;
}

function highlightSurface(color: ColorMapper) {
  const canvas = surface(80, 180);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const light = ctx.createLinearGradient(0, 0, 80, 0);
  light.addColorStop(0, color('rgba(196,243,255,0)'));
  light.addColorStop(.43, color('rgba(196,243,255,.025)'));
  light.addColorStop(.5, color('rgba(226,252,255,.17)'));
  light.addColorStop(.57, color('rgba(196,243,255,.025)'));
  light.addColorStop(1, color('rgba(196,243,255,0)'));
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, 80, 180);
  return canvas;
}

function scanSurface(color: ColorMapper) {
  const canvas = surface(24, 4);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.fillStyle = color('rgba(89,231,255,.24)');
  ctx.fillRect(0, 0, 24, .8);
  ctx.fillStyle = color('rgba(89,231,255,.06)');
  ctx.fillRect(0, 0, .7, 4);
  return canvas;
}

function sweepSurface(color: ColorMapper) {
  const canvas = surface(8, 80);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const light = ctx.createLinearGradient(0, 0, 0, 80);
  light.addColorStop(0, color('rgba(67,207,244,0)'));
  light.addColorStop(.68, color('rgba(67,207,244,.065)'));
  light.addColorStop(.92, color('rgba(130,244,255,.16)'));
  light.addColorStop(1, color('rgba(67,207,244,0)'));
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, 8, 80);
  ctx.fillStyle = color('rgba(175,248,255,.32)');
  ctx.fillRect(0, 73, 8, .65);
  return canvas;
}

/**
 * Create once per theme inside the player's effect. Materials and patterns are cached;
 * only a small 320 x 180 bloom surface is redrawn for each scene frame.
 */
export function createFilmTextureRenderer(theme: FilmThemeId = DEFAULT_FILM_THEME) {
  const color = createFilmColorMapper(theme);
  const grain = noiseSurface(color);
  const reflection = reflectionSurface(color);
  const vignette = vignetteSurface(color);
  const highlight = highlightSurface(color);
  const scan = scanSurface(color);
  const sweep = sweepSurface(color);
  const filmTint = color('rgba(242,209,153,.018)');
  const bloom = surface(320, 180);
  const bloomContext = bloom.getContext('2d');
  const patterns = new WeakMap<CanvasRenderingContext2D, { grain: CanvasPattern | null; scan: CanvasPattern | null }>();

  return function drawFilmTexture(ctx: CanvasRenderingContext2D, width: number, height: number,
    time: number, settings: FilmTextureSettings): void {
    const intensity = Number.isFinite(settings.intensity) ? Math.max(0, Math.min(1, settings.intensity)) : 0;
    if (settings.style === 'none' || intensity === 0 || !Number.isFinite(width) || !Number.isFinite(height)
      || width <= 0 || height <= 0) return;
    const t = Number.isFinite(time) ? Math.max(0, time) : 0;
    let material = patterns.get(ctx);
    if (!material) {
      material = { grain: ctx.createPattern(grain, 'repeat'), scan: ctx.createPattern(scan, 'repeat') };
      patterns.set(ctx, material);
    }

    ctx.save();
    // Scene renderers may leave their logical transform and drawing state active.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'none';
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.setLineDash([]);

    if (bloomContext) {
      bloomContext.clearRect(0, 0, 320, 180);
      bloomContext.filter = 'blur(3px)';
      bloomContext.drawImage(ctx.canvas, 0, 0, width, height, 0, 0, 320, 180);
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = intensity * (settings.style === 'film' ? .13 : .3);
      ctx.drawImage(bloom, 0, 0, width, height);
    }

    // Physical pixel dimensions above make the pass independent of scene scale;
    // normalized coordinates below keep material detail consistent across DPRs.
    ctx.setTransform(width / VIEW_WIDTH, 0, 0, height / VIEW_HEIGHT, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    if (settings.style === 'glass') {
      ctx.globalAlpha = intensity;
      ctx.drawImage(reflection, 0, 0, VIEW_WIDTH, VIEW_HEIGHT);
      ctx.save();
      ctx.translate(420 + Math.sin(t * .085) * 160, 340);
      ctx.rotate(.38);
      ctx.globalAlpha = intensity * .55;
      ctx.drawImage(highlight, -145, -600, 290, 1200);
      ctx.restore();
      ctx.globalAlpha = intensity * .28;
      ctx.drawImage(vignette, 0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    } else if (settings.style === 'film') {
      ctx.globalAlpha = intensity;
      ctx.fillStyle = filmTint;
      ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
      ctx.drawImage(vignette, 0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    } else if (settings.style === 'hologram') {
      ctx.globalAlpha = intensity * .55;
      if (material.scan) {
        ctx.fillStyle = material.scan;
        ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
      }
      ctx.globalAlpha = intensity;
      ctx.drawImage(sweep, 0, (t * 32 % 940) - 180, VIEW_WIDTH, 220);
      ctx.globalAlpha = intensity * .5;
      ctx.drawImage(vignette, 0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    }

    if (material.grain) {
      const phase = settings.style === 'film' ? Math.floor(t * 12) : 0;
      const offsetX = phase * 73 % 256;
      const offsetY = phase * 151 % 256;
      ctx.translate(-offsetX, -offsetY);
      ctx.globalAlpha = intensity * (settings.style === 'film' ? .44 : .11);
      ctx.fillStyle = material.grain;
      ctx.fillRect(offsetX, offsetY, VIEW_WIDTH, VIEW_HEIGHT);
    }
    ctx.restore();
  };
}
