import { getFilmTheme, type FilmThemeId } from './filmThemes';
import { smooth } from './filmDrawing';
import { clamp as clampRange } from './filmMath';

type RGB = readonly [number, number, number];
interface ParsedColor { rgb: RGB; alpha: number }
interface HSL { h: number; s: number; l: number }

const SOURCE_ACCENT: RGB = [95, 227, 255];
const SOURCE_WARNING: RGB = [255, 193, 104];
const COLOR_CACHE_LIMIT = 2048;
const RGB_CACHE_LIMIT = 512;
const clamp = (value: number, min = 0, max = 1) => clampRange(value, min, max);
const mixRGB = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t,
];

function numberToken(token: string, maximum: number): number | null {
  const text = token.trim();
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?%?$/i.test(text)) return null;
  const value = Number(text.endsWith('%') ? text.slice(0, -1) : text);
  return Number.isFinite(value) ? clamp(text.endsWith('%') ? value * maximum / 100 : value, 0, maximum) : null;
}

function parseColor(color: string): ParsedColor | null {
  const text = color.trim();
  const hex = /^#([\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.exec(text);
  if (hex) {
    const digits = hex[1].length <= 4 ? Array.from(hex[1], digit => digit + digit).join('') : hex[1];
    return {
      rgb: [Number.parseInt(digits.slice(0, 2), 16), Number.parseInt(digits.slice(2, 4), 16), Number.parseInt(digits.slice(4, 6), 16)],
      alpha: digits.length === 8 ? Number.parseInt(digits.slice(6, 8), 16) / 255 : 1,
    };
  }
  const functionColor = /^rgba?\((.*)\)$/i.exec(text);
  if (!functionColor) return null;
  const body = functionColor[1].trim();
  let channels: string[], alpha = '1';
  if (body.includes(',')) {
    if (body.includes('/')) return null;
    const parts = body.split(',');
    if (parts.length !== 3 && parts.length !== 4) return null;
    channels = parts.slice(0, 3);
    if (channels.some(channel => channel.trim().endsWith('%')) && !channels.every(channel => channel.trim().endsWith('%'))) return null;
    if (parts.length === 4) alpha = parts[3];
  } else {
    const parts = body.split('/');
    if (parts.length > 2) return null;
    channels = parts[0].trim().split(/\s+/);
    if (channels.length !== 3) return null;
    if (parts.length === 2) alpha = parts[1];
  }
  const rgb = channels.map(channel => numberToken(channel, 255));
  const opacity = numberToken(alpha, 1);
  if (rgb.some(channel => channel === null) || opacity === null) return null;
  return { rgb: rgb as unknown as RGB, alpha: opacity };
}

function toHSL(rgb: RGB): HSL {
  const [r, g, b] = rgb.map(channel => channel / 255);
  const maximum = Math.max(r, g, b), minimum = Math.min(r, g, b);
  const delta = maximum - minimum, lightness = (maximum + minimum) / 2;
  if (delta === 0) return { h: 0, s: 0, l: lightness };
  const hue = maximum === r ? ((g - b) / delta + 6) % 6 : maximum === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  return { h: hue * 60, s: delta / (1 - Math.abs(2 * lightness - 1)), l: lightness };
}

function fromHSL({ h, s, l }: HSL): RGB {
  const hue = ((h % 360) + 360) % 360 / 60;
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const secondary = chroma * (1 - Math.abs(hue % 2 - 1));
  const low = l - chroma / 2;
  const channels = hue < 1 ? [chroma, secondary, 0] : hue < 2 ? [secondary, chroma, 0]
    : hue < 3 ? [0, chroma, secondary] : hue < 4 ? [0, secondary, chroma]
      : hue < 5 ? [secondary, 0, chroma] : [chroma, 0, secondary];
  return channels.map(channel => (channel + low) * 255) as unknown as RGB;
}

/** Preserve each tint's distance from its reference, without lifting absolute black or clipping white. */
function relativeTint(source: HSL, reference: HSL, target: HSL, hue = target.h): RGB {
  const lightnessWeight = Math.min(1, source.l / Math.max(.001, reference.l),
    (1 - source.l) / Math.max(.001, 1 - reference.l));
  return fromHSL({ h: hue, s: clamp(source.s * target.s / Math.max(.001, reference.s)),
    l: clamp(source.l + (target.l - reference.l) * lightnessWeight) });
}

function cacheValue<K, V>(cache: Map<K, V>, key: K, value: V, limit: number) {
  if (cache.size >= limit) cache.delete(cache.keys().next().value!);
  cache.set(key, value);
  return value;
}

/** Map the source palette and its heat blends while keeping neutrals and alpha intact. */
export function createFilmColorMapper(theme: FilmThemeId): (color: string) => string {
  const palette = getFilmTheme(theme);
  if (palette.id === 'cyan') return color => color;
  const accent = parseColor(palette.accent)!.rgb, warning = parseColor(palette.warning)!.rgb;
  const sourceAccent = toHSL(SOURCE_ACCENT), sourceWarning = toHSL(SOURCE_WARNING);
  const targetAccent = toHSL(accent), targetWarning = toHSL(warning);
  const colors = new Map<string, string>(), channels = new Map<string, RGB>();

  const mapChannels = (rgb: RGB): RGB => {
    const key = rgb.join(',');
    const cached = channels.get(key);
    if (cached) return cached;
    const source = toHSL(rgb);
    const chroma = Math.max(...rgb) - Math.min(...rgb);
    if (chroma < 1e-8) return cacheValue(channels, key, rgb, RGB_CACHE_LIMIT);

    const coolWeight = smooth(65, 100, source.h) * (1 - smooth(265, 305, source.h));
    const warmWeight = smooth(5, 25, source.h) * (1 - smooth(65, 100, source.h));
    if (coolWeight === 0 && (warmWeight === 0 || palette.warning === '#ffc168')) {
      return cacheValue(channels, key, rgb, RGB_CACHE_LIMIT);
    }
    let mapped = rgb;
    if (warmWeight > 0 && palette.warning !== '#ffc168') {
      const warm = relativeTint(source, sourceWarning, targetWarning, targetWarning.h + source.h - sourceWarning.h);
      mapped = mixRGB(mapped, warm, warmWeight);
    }
    if (coolWeight > 0) {
      let cool: RGB;
      if (source.h <= sourceAccent.h) {
        // Source RGB heat blends traverse cyan -> green -> amber; follow that same path.
        let low = 0, high = 1;
        for (let step = 0; step < 18; step++) {
          const middle = (low + high) / 2;
          if (toHSL(mixRGB(SOURCE_ACCENT, SOURCE_WARNING, middle)).h > source.h) low = middle;
          else high = middle;
        }
        const heat = (low + high) / 2;
        const reference = toHSL(mixRGB(SOURCE_ACCENT, SOURCE_WARNING, heat));
        const target = toHSL(mixRGB(accent, warning, heat));
        cool = relativeTint(source, reference, target);
      } else {
        cool = relativeTint(source, sourceAccent, targetAccent, targetAccent.h + (source.h - sourceAccent.h) * .6);
      }
      mapped = mixRGB(mapped, cool, coolWeight);
    }
    // Hue becomes unstable near grey; fade its contribution continuously as chroma vanishes.
    mapped = mixRGB(rgb, mapped, smooth(0, 10, chroma));
    const result = mapped.map(channel => Math.round(clamp(channel, 0, 255))) as unknown as RGB;
    return cacheValue(channels, key, result, RGB_CACHE_LIMIT);
  };

  return color => {
    const cached = colors.get(color);
    if (cached !== undefined) return cached;
    const parsed = parseColor(color);
    if (!parsed) return cacheValue(colors, color, color, COLOR_CACHE_LIMIT);
    const mapped = mapChannels(parsed.rgb);
    const unchanged = mapped.every((channel, index) => channel === parsed.rgb[index]);
    const result = unchanged ? color : parsed.alpha === 1 ? `rgb(${mapped.join(',')})` : `rgba(${mapped.join(',')},${parsed.alpha})`;
    return cacheValue(colors, color, result, COLOR_CACHE_LIMIT);
  };
}

const COLOR_PROPERTIES = new Set<PropertyKey>(['fillStyle', 'strokeStyle', 'shadowColor']);
const GRADIENT_METHODS = new Set<PropertyKey>(['createLinearGradient', 'createRadialGradient', 'createConicGradient']);
const CONTEXT_THEMES = new WeakMap<CanvasRenderingContext2D, FilmThemeId>();

/** Offscreen renderers inherit the palette before their pixels are composited. */
export function getFilmContextTheme(context: CanvasRenderingContext2D): FilmThemeId {
  return CONTEXT_THEMES.get(context) ?? 'cyan';
}

/** Wrap one renderer context; native gradients and patterns retain their original identity. */
export function createFilmThemeContext(context: CanvasRenderingContext2D, theme: FilmThemeId = 'cyan') {
  let currentTheme = getFilmTheme(theme).id;
  let mapColor = createFilmColorMapper(currentTheme);
  const methods = new Map<PropertyKey, { source: unknown; bound: unknown }>();
  const ctx = new Proxy(context, {
    get(target, property) {
      const value = Reflect.get(target, property, target);
      if (typeof value !== 'function' || property === 'constructor') return value;
      const cached = methods.get(property);
      if (cached && cached.source === value) return cached.bound;
      const bound = GRADIENT_METHODS.has(property) ? (...args: unknown[]) => {
        const gradient = Reflect.apply(value, target, args) as CanvasGradient;
        const addColorStop = gradient.addColorStop.bind(gradient);
        Object.defineProperty(gradient, 'addColorStop', {
          configurable: true, writable: true,
          value: (offset: number, color: string) => addColorStop(offset, typeof color === 'string' ? mapColor(color) : color),
        });
        return gradient;
      } : value.bind(target);
      methods.set(property, { source: value, bound });
      return bound;
    },
    set(target, property, value) {
      return Reflect.set(target, property, COLOR_PROPERTIES.has(property) && typeof value === 'string' ? mapColor(value) : value, target);
    },
  });
  CONTEXT_THEMES.set(context, currentTheme);
  CONTEXT_THEMES.set(ctx, currentTheme);
  return {
    /**
     * The default palette maps every color to itself, so hand the renderer the native context and
     * skip the Proxy traps that would otherwise wrap every draw call and style write of every frame.
     */
    get ctx() { return currentTheme === 'cyan' ? context : ctx; },
    setTheme(id: FilmThemeId) {
      const next = getFilmTheme(id).id;
      if (next === currentTheme) return;
      currentTheme = next;
      mapColor = createFilmColorMapper(next);
      CONTEXT_THEMES.set(context, next);
      CONTEXT_THEMES.set(ctx, next);
    },
  };
}
